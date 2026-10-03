import * as THREE from 'three';
import { createNoise2D } from './noise.js';
import { createTerrain } from './terrain.js';
import { scatterWorld } from './scatter.js';
import { Player } from './player.js';
import { createSky } from './sky.js';
import { buildLandmarks, animateLandmarks } from './landmarks.js';
import { buildSpaceship, animateSpaceship } from './spaceship.js';
import { createInfoPanel } from './infoPanel.js';

const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#05060f', 40, 240);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- World ---
const noise2D = createNoise2D(1337);
const terrain = createTerrain(noise2D);
scene.add(terrain);

const landmarks = buildLandmarks(scene, terrain);
const ship = buildSpaceship(scene, terrain, landmarks);
const infoPanel = createInfoPanel();

const rocks = scatterWorld(scene, terrain, {
  avoidPoints: [{ x: 0, z: 0 }, ...landmarks.map((lm) => ({ x: lm.position.x, z: lm.position.z }))],
  avoidPointRadius: 10,
});
scene.add(createSky());

// --- Lights, with a slow day cycle so the scene never looks static ---
const ambient = new THREE.HemisphereLight('#2a3550', '#55504a', 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight('#fff3d6', 1.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.camera.far = 300;
scene.add(sun);
scene.add(sun.target);

// --- Player ---
const player = new Player(terrain, new THREE.Vector3(0, 0, 0), rocks);
scene.add(player.group);

// --- Camera rig: drag-to-look third person orbit, pinch-to-zoom on touch ---
const cameraState = { yaw: Math.PI, pitch: 0.45, distance: 9 };
let dragging = false;
let lastPointer = { x: 0, y: 0 };

// Tracks every pointer currently down on the canvas (by id) so two-finger
// touch can pinch-zoom instead of fighting the single-finger orbit drag.
const activeCanvasPointers = new Map();
let pinchStartDist = null;
let pinchStartDistance = null;

canvas.addEventListener('pointerdown', (e) => {
  activeCanvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activeCanvasPointers.size === 1) {
    dragging = true;
    lastPointer = { x: e.clientX, y: e.clientY };
  } else if (activeCanvasPointers.size === 2) {
    dragging = false;
    const [a, b] = activeCanvasPointers.values();
    pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
    pinchStartDistance = cameraState.distance;
  }
});
window.addEventListener('pointermove', (e) => {
  if (!activeCanvasPointers.has(e.pointerId)) return;
  activeCanvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activeCanvasPointers.size >= 2) {
    const [a, b] = activeCanvasPointers.values();
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStartDist) {
      cameraState.distance = THREE.MathUtils.clamp(pinchStartDistance * (pinchStartDist / dist), 4, 20);
    }
    return;
  }
  if (!dragging) return;
  const dx = e.clientX - lastPointer.x;
  const dy = e.clientY - lastPointer.y;
  lastPointer = { x: e.clientX, y: e.clientY };
  cameraState.yaw -= dx * 0.005;
  cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch - dy * 0.005, 0.1, 1.2);
});
function releaseCanvasPointer(e) {
  activeCanvasPointers.delete(e.pointerId);
  if (activeCanvasPointers.size === 0) {
    dragging = false;
    pinchStartDist = null;
  } else if (activeCanvasPointers.size === 1) {
    // Dropped from two fingers to one: resume single-finger orbit from
    // wherever that remaining finger already is, so it doesn't jump.
    const [p] = activeCanvasPointers.values();
    dragging = true;
    lastPointer = { x: p.x, y: p.y };
    pinchStartDist = null;
  }
}
window.addEventListener('pointerup', releaseCanvasPointer);
window.addEventListener('pointercancel', releaseCanvasPointer);
canvas.addEventListener('wheel', (e) => {
  cameraState.distance = THREE.MathUtils.clamp(cameraState.distance + e.deltaY * 0.01, 4, 20);
});

// --- Keyboard input ---
const input = { forward: false, back: false, left: false, right: false, run: false, jump: false, sneak: false };
const keyMap = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left', // pivot-turn left (left track back, right track forward)
  KeyD: 'right', ArrowRight: 'right', // pivot-turn right
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
  ControlLeft: 'sneak', ControlRight: 'sneak',
};
window.addEventListener('keydown', (e) => {
  const key = keyMap[e.code];
  if (key) {
    input[key] = true;
    // Sneak lives on Ctrl, so Ctrl+W/S/A would otherwise trigger the
    // browser's close-tab/save-page/select-all shortcuts while sneaking.
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  const key = keyMap[e.code];
  if (key) input[key] = false;
});

// --- Touch controls: virtual joystick (move) + hold buttons (run/jump) ---
// Shown only on coarse-pointer (touchscreen) devices, so desktop keeps the
// plain keyboard/mouse experience. Re-checked on change so plugging in a
// mouse (or a devtools toggle) swaps the overlay copy live.
const touchModeQuery = window.matchMedia('(pointer: coarse)');
function updateTouchMode() {
  document.body.classList.toggle('touch-mode', touchModeQuery.matches);
}
updateTouchMode();
touchModeQuery.addEventListener('change', updateTouchMode);

const touchControls = document.getElementById('touch-controls');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const JOY_RADIUS = 60;
const JOY_DEADZONE = 0.35;
let joystickPointerId = null;

function setJoystickFromCenter(dx, dy) {
  const dist = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(dist, JOY_RADIUS);
  const kx = (dx / dist) * clamped;
  const ky = (dy / dist) * clamped;
  joystickKnob.style.transform = `translate(${kx}px, ${ky}px)`;

  const nx = kx / JOY_RADIUS;
  const ny = ky / JOY_RADIUS;
  input.forward = ny < -JOY_DEADZONE;
  input.back = ny > JOY_DEADZONE;
  input.left = nx < -JOY_DEADZONE;
  input.right = nx > JOY_DEADZONE;
}
function resetJoystick() {
  joystickKnob.style.transform = 'translate(0px, 0px)';
  input.forward = false;
  input.back = false;
  input.left = false;
  input.right = false;
}
joystickBase.addEventListener('pointerdown', (e) => {
  joystickPointerId = e.pointerId;
  try { joystickBase.setPointerCapture(e.pointerId); } catch { /* ignore: capture is a nicety, not required */ }
  const rect = joystickBase.getBoundingClientRect();
  setJoystickFromCenter(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
});
joystickBase.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joystickPointerId) return;
  const rect = joystickBase.getBoundingClientRect();
  setJoystickFromCenter(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
});
function releaseJoystick(e) {
  if (e.pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  resetJoystick();
}
joystickBase.addEventListener('pointerup', releaseJoystick);
joystickBase.addEventListener('pointercancel', releaseJoystick);

// Hold-to-run / hold-to-jump buttons, mirroring the keyboard's hold semantics.
// Pointer capture keeps the press "latched" to the button even if the finger
// drifts a few pixels, which touch input does constantly.
function bindHoldButton(el, key) {
  el.addEventListener('pointerdown', (e) => {
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore: capture is a nicety, not required */ }
    input[key] = true;
    el.classList.add('active');
  });
  const release = () => {
    input[key] = false;
    el.classList.remove('active');
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}
bindHoldButton(document.getElementById('run-btn'), 'run');
bindHoldButton(document.getElementById('jump-btn'), 'jump');

// Help overlay: auto-hides after the first real input, but can be
// recalled any time with H or the "?" button — easy to forget the keys.
const overlay = document.getElementById('overlay');
const helpBtn = document.getElementById('help-btn');

function hideOverlayOnce() {
  overlay.classList.add('hidden');
  window.removeEventListener('keydown', hideOverlayOnce);
  canvas.removeEventListener('pointerdown', hideOverlayOnce);
  touchControls.removeEventListener('pointerdown', hideOverlayOnce);
}
window.addEventListener('keydown', hideOverlayOnce, { once: true });
canvas.addEventListener('pointerdown', hideOverlayOnce, { once: true });
touchControls.addEventListener('pointerdown', hideOverlayOnce, { once: true });

function toggleHelp() {
  overlay.classList.toggle('hidden');
}
helpBtn.addEventListener('click', toggleHelp);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' || e.code === 'Slash') toggleHelp();
});

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Main loop ---
const timer = new THREE.Timer();
let dayTime = 0.35; // 0..1, fraction of a full day cycle

function updateNearestLandmark() {
  let nearest = null;
  let nearestDist = Infinity;
  for (const lm of landmarks) {
    const d = player.group.position.distanceTo(lm.position);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = lm;
    }
  }
  if (nearest && nearestDist <= nearest.triggerRadius) {
    infoPanel.show(nearest.data);
  } else {
    infoPanel.hide();
  }
}

function render() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const elapsed = timer.getElapsed();

  player.update(dt, input);
  animateLandmarks(landmarks, elapsed);
  animateSpaceship(ship, elapsed);
  updateNearestLandmark();

  // Smoothly follow the player with the orbit camera. There's no single
  // world "up" on a sphere, so the orbit basis is built from the player's
  // own local up (surface normal) each frame instead of a fixed Y axis.
  const localUp = player.up;
  const referenceHelper = Math.abs(localUp.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const tangentX = new THREE.Vector3().crossVectors(referenceHelper, localUp).normalize();
  const tangentZ = new THREE.Vector3().crossVectors(localUp, tangentX).normalize();

  const target = player.group.position.clone().addScaledVector(localUp, 1.4);
  const offset = new THREE.Vector3()
    .addScaledVector(tangentX, Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch))
    .addScaledVector(tangentZ, Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch))
    .addScaledVector(localUp, Math.sin(cameraState.pitch))
    .multiplyScalar(cameraState.distance);
  const desiredPos = target.clone().add(offset);
  camera.up.copy(localUp);
  camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));
  camera.lookAt(target);

  // Slow day-night cycle: sun arcs across the sky, light warms/cools.
  dayTime = (dayTime + dt * 0.01) % 1;
  const sunAngle = dayTime * Math.PI * 2;
  sun.position.set(Math.cos(sunAngle) * 150, Math.sin(sunAngle) * 150 + 40, 60);
  sun.target.position.copy(player.group.position);
  const elevation = Math.sin(sunAngle);
  sun.intensity = THREE.MathUtils.clamp(0.3 + elevation * 1.2, 0.15, 1.6);
  const warmth = THREE.MathUtils.clamp(1 - elevation, 0, 1);
  sun.color.setRGB(1, 1 - warmth * 0.35, 1 - warmth * 0.6);

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
