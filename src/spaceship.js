import * as THREE from 'three';
import { placeOnSphere, PLANET_CENTER } from './terrain.js';
import { makeTextTexture } from './textLabel.js';

const KIND_COLOR = {
  about: '#ffd27a',
  contact: '#8adfff',
  project: '#ff8a5c',
};

const LEG_COUNT = 4;
const HULL_HEIGHT = 5.2;
const HULL_BASE_Y = 1.6; // leg height the hull sits on top of

function makeHull() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#d9d6cc', roughness: 0.45, metalness: 0.6 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.6, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#8adfff', emissive: '#8adfff', emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });

  // Tapered capsule body, narrower at the top.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.6, HULL_HEIGHT, 16), hullMat);
  body.position.y = HULL_BASE_Y + HULL_HEIGHT / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Panel-seam rings around the hull.
  [0.28, 0.58, 0.85].forEach((t) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(THREE.MathUtils.lerp(2.5, 1.6, t) + 0.03, 0.06, 6, 20),
      trimMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = HULL_BASE_Y + HULL_HEIGHT * t;
    group.add(ring);
  });

  // Rounded nose cap.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hullMat);
  nose.position.y = HULL_BASE_Y + HULL_HEIGHT;
  nose.castShadow = true;
  group.add(nose);

  // Cockpit porthole.
  const port = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), glassMat);
  port.position.set(0, HULL_BASE_Y + HULL_HEIGHT * 0.72, 1.55);
  group.add(port);
  group.userData.glass = glassMat;

  // Beacon mast + light on the nose.
  const mastHeight = 0.6;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, mastHeight, 6), trimMat);
  mast.position.y = HULL_BASE_Y + HULL_HEIGHT + mastHeight / 2;
  group.add(mast);

  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff5c5c' });
  const beaconBulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), beaconMat);
  beaconBulb.position.y = HULL_BASE_Y + HULL_HEIGHT + mastHeight;
  group.add(beaconBulb);

  const beaconLight = new THREE.PointLight('#ff5c5c', 0, 20);
  beaconLight.position.copy(beaconBulb.position);
  group.add(beaconLight);

  group.userData.beaconMat = beaconMat;
  group.userData.beaconLight = beaconLight;
  group.userData.beaconTop = beaconBulb.position.clone();

  // Open hatch + ramp, the way into the ship (and the world).
  const hatchMat = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.4, metalness: 0.3 });
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 0.15), hatchMat);
  hatch.position.set(0, HULL_BASE_Y + 1.3, -2.55);
  group.add(hatch);

  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.85 });
  const interiorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), glowMat);
  // Sits just outside the hatch face so it reads as light spilling out, not buried inside the door mesh.
  interiorGlow.position.set(0, HULL_BASE_Y + 1.3, -2.63);
  interiorGlow.rotation.y = Math.PI;
  group.add(interiorGlow);

  const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 3.2), trimMat);
  ramp.position.set(0, HULL_BASE_Y * 0.42, -4.1);
  ramp.rotation.x = -0.42;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  group.add(ramp);

  // Landing legs: angled struts with footpads, evenly spaced around the hull.
  const legMat = new THREE.MeshStandardMaterial({ color: '#4a4c52', roughness: 0.7, metalness: 0.5 });
  for (let i = 0; i < LEG_COUNT; i += 1) {
    const angle = (i / LEG_COUNT) * Math.PI * 2 + Math.PI / 4;
    const outerX = Math.cos(angle) * 2.5;
    const outerZ = Math.sin(angle) * 2.5;

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, HULL_BASE_Y + 1.2, 6), legMat);
    strut.position.set(outerX * 0.55, HULL_BASE_Y * 0.5, outerZ * 0.55);
    strut.lookAt(new THREE.Vector3(outerX, 0, outerZ));
    strut.rotateX(Math.PI / 2);
    strut.castShadow = true;
    group.add(strut);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 10), legMat);
    pad.position.set(outerX, 0.06, outerZ);
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);
  }

  // Engine nozzle, half-sunk into the ground under the hull.
  const engineMat = new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.5, metalness: 0.6 });
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 1.1, 10), engineMat);
  nozzle.position.y = HULL_BASE_Y * 0.3;
  nozzle.castShadow = true;
  group.add(nozzle);

  const emberMat = new THREE.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, opacity: 0.6 });
  const ember = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), emberMat);
  ember.rotation.x = -Math.PI / 2;
  ember.position.y = 0.02;
  group.add(ember);
  group.userData.emberMat = emberMat;
  const emberLight = new THREE.PointLight('#ff8a3c', 1.2, 6);
  emberLight.position.y = 0.3;
  group.add(emberLight);
  group.userData.emberLight = emberLight;

  // Scorch mark burned into the ground from landing.
  const scorchMat = new THREE.MeshBasicMaterial({ color: '#0c0c0e', transparent: true, opacity: 0.45 });
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), scorchMat);
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.015;
  group.add(scorch);

  return group;
}

function makeBeam(color) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true), material);
  const pulseMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), pulseMat);
  return { beam, pulse, material };
}

// A landed capsule lander at the world's center, with holographic beams
// fanning out to every landmark instead of the old signpost's physical arms.
export function buildSpaceship(scene, terrainMesh, landmarks) {
  const { position: hubPosition, dir: hubUp } = placeOnSphere(terrainMesh, 0, 0);

  const group = new THREE.Group();
  group.position.copy(hubPosition);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hubUp);
  scene.add(group);

  const hull = makeHull();
  group.add(hull);

  const beamOrigin = hubPosition.clone().addScaledVector(hubUp, HULL_BASE_Y + HULL_HEIGHT * 0.5);

  const beams = landmarks.map((lm) => {
    const landmarkUp = lm.position.clone().sub(PLANET_CENTER).normalize();
    const target = lm.position.clone().addScaledVector(landmarkUp, 2.2);
    const color = KIND_COLOR[lm.data.kind] ?? '#ffffff';
    const { beam, pulse, material } = makeBeam(color);

    const delta = target.clone().sub(beamOrigin);
    const length = delta.length();
    const mid = beamOrigin.clone().addScaledVector(delta, 0.5);

    beam.position.copy(mid);
    beam.scale.y = length;
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    scene.add(beam);
    scene.add(pulse);

    const label = lm.data.kind === 'project'
      ? `${lm.data.index} ${lm.data.title}`
      : lm.data.title;
    const texture = makeTextTexture([label], { width: 384, height: 96, bg: 'rgba(10,12,8,0.7)' });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(3.2, 0.8, 1);
    sprite.position.copy(beamOrigin.clone().addScaledVector(delta, 0.55).addScaledVector(hubUp, 1.2));
    scene.add(sprite);

    return { material, pulse, origin: beamOrigin, target, phase: Math.random() * Math.PI * 2 };
  });

  return { group, hull, beams };
}

export function animateSpaceship(ship, elapsed) {
  const { hull, beams } = ship;

  const blink = Math.sin(elapsed * 3) > 0.5 ? 1.4 : 0;
  hull.userData.beaconLight.intensity = blink;
  hull.userData.beaconMat.color.setScalar(blink > 0 ? 1 : 0.3);

  const flicker = 0.5 + Math.sin(elapsed * 11) * 0.15 + Math.sin(elapsed * 23.7) * 0.08;
  hull.userData.emberMat.opacity = 0.45 + flicker * 0.3;
  hull.userData.emberLight.intensity = 0.9 + flicker * 0.6;

  beams.forEach((b) => {
    b.material.opacity = 0.22 + Math.sin(elapsed * 1.6 + b.phase) * 0.12;
    const t = (elapsed * 0.35 + b.phase / (Math.PI * 2)) % 1;
    b.pulse.position.copy(b.origin).lerp(b.target, t);
  });
}
