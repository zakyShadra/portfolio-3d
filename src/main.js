import * as THREE from 'three';
import { createNoise2D } from './noise.js';
import { createTerrain } from './terrain.js';
import { scatterWorld } from './scatter.js';
import { Player } from './player.js';
import { createSky, createClouds, animateClouds } from './sky.js';

const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#bcd9e0', 60, 320);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- World ---
const noise2D = createNoise2D(1337);
const terrain = createTerrain(noise2D);
scene.add(terrain);
scatterWorld(scene, noise2D);
scene.add(createSky());
const clouds = createClouds();
scene.add(clouds);

// --- Lights, with a slow day cycle so the scene never looks static ---
const ambient = new THREE.HemisphereLight('#bcd9e0', '#4a6b3a', 0.6);
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
const player = new Player(noise2D, new THREE.Vector3(0, 0, 0));
scene.add(player.group);

// --- Camera rig: drag-to-look third person orbit ---
const cameraState = { yaw: Math.PI, pitch: 0.45, distance: 9 };
let dragging = false;
let lastPointer = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastPointer = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', () => (dragging = false));
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastPointer.x;
  const dy = e.clientY - lastPointer.y;
  lastPointer = { x: e.clientX, y: e.clientY };
  cameraState.yaw -= dx * 0.005;
  cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch - dy * 0.005, 0.1, 1.2);
});
canvas.addEventListener('wheel', (e) => {
  cameraState.distance = THREE.MathUtils.clamp(cameraState.distance + e.deltaY * 0.01, 4, 20);
});

// --- Keyboard input ---
const input = { forward: false, back: false, left: false, right: false, run: false, jump: false };
const keyMap = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
};
window.addEventListener('keydown', (e) => {
  const key = keyMap[e.code];
  if (key) input[key] = true;
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  const key = keyMap[e.code];
  if (key) input[key] = false;
});

// Hide the help overlay after the first real input.
const overlay = document.getElementById('overlay');
function dismissOverlay() {
  overlay.classList.add('hidden');
  window.removeEventListener('keydown', dismissOverlay);
  canvas.removeEventListener('pointerdown', dismissOverlay);
}
window.addEventListener('keydown', dismissOverlay, { once: true });
canvas.addEventListener('pointerdown', dismissOverlay, { once: true });

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Main loop ---
const clock = new THREE.Clock();
let dayTime = 0.35; // 0..1, fraction of a full day cycle

function render() {
  const dt = Math.min(clock.getDelta(), 0.05);

  player.update(dt, input, cameraState.yaw);

  // Smoothly follow the player with the orbit camera.
  const target = player.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  const offset = new THREE.Vector3(
    Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch),
    Math.sin(cameraState.pitch),
    Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch),
  ).multiplyScalar(cameraState.distance);
  const desiredPos = target.clone().add(offset);
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

  animateClouds(clouds, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
