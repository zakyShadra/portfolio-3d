import * as THREE from 'three';
import { placeOnSphere, PLANET_CENTER } from './terrain.js';
import { makeTextTexture } from './textLabel.js';

const KIND_COLOR = {
  about: '#ffd27a',
  contact: '#8adfff',
  project: '#ff8a5c',
};

const SHIP_SCALE = 2; // overall size multiplier — big enough to walk into

const LEG_COUNT = 4;
const HULL_HEIGHT = 5.2;
// The player's height always comes from raycasting the terrain mesh, never
// from standing on a ship mesh — so the interior floor has to sit flush at
// 0 (actual ground level) or the player's feet end up below/through it,
// which is exactly the "dasar tembus" bug: the floor used to float ~0.6
// world units above where the player's feet really are.
const HULL_BASE_Y = 0;
const BOTTOM_RADIUS = 2.6;
const TOP_RADIUS = 1.5;

// The doorway is a real gap cut into the hull geometry (not a panel glued on
// top of it), so it reads as part of the hull and the player can actually
// walk through it into the lit interior.
const DOOR_HEIGHT_FRAC = 0.45; // fraction of HULL_HEIGHT that's door-height
const DOOR_ANGULAR_WIDTH = 1.0; // radians
// Standard math convention (x = r·cosφ, z = r·sinφ) — same as legs/colliders
// below. Faces -Z, same side the beams/landmarks read from.
const DOOR_FACING_ANGLE = -Math.PI / 2;
// CylinderGeometry's thetaStart uses its OWN convention (x = r·sinθ, z =
// r·cosθ — verified empirically, it's a quarter-turn off from the standard
// one above), so the door's cut has to be placed in theta-space instead.
const DOOR_THETA = Math.PI / 2 - DOOR_FACING_ANGLE;

function hullRadiusAt(t) {
  return THREE.MathUtils.lerp(BOTTOM_RADIUS, TOP_RADIUS, t);
}

function makeHull() {
  const group = new THREE.Group();
  // DoubleSide so the inside of the door-section walls is visible too —
  // standing inside (or looking in through the gap) would otherwise show
  // nothing, since a mesh's back faces are culled by default.
  const hullMat = new THREE.MeshStandardMaterial({ color: '#d9d6cc', roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.6, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#8adfff', emissive: '#8adfff', emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });

  const doorSectionHeight = HULL_HEIGHT * DOOR_HEIGHT_FRAC;
  const seamY = HULL_BASE_Y + doorSectionHeight;
  const seamRadius = hullRadiusAt(DOOR_HEIGHT_FRAC);

  // Lower section: a tapered ring with a wedge missing — the doorway.
  const doorThetaStart = DOOR_THETA + DOOR_ANGULAR_WIDTH / 2;
  const doorThetaLength = Math.PI * 2 - DOOR_ANGULAR_WIDTH;
  const lowerBody = new THREE.Mesh(
    new THREE.CylinderGeometry(seamRadius, BOTTOM_RADIUS, doorSectionHeight, 16, 1, true, doorThetaStart, doorThetaLength),
    hullMat,
  );
  lowerBody.position.y = HULL_BASE_Y + doorSectionHeight / 2;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  group.add(lowerBody);

  // Upper section: the rest of the taper, solid all the way round.
  const upperHeight = HULL_HEIGHT - doorSectionHeight;
  const upperBody = new THREE.Mesh(
    new THREE.CylinderGeometry(TOP_RADIUS, seamRadius, upperHeight, 16, 1, true),
    hullMat,
  );
  upperBody.position.y = seamY + upperHeight / 2;
  upperBody.castShadow = true;
  upperBody.receiveShadow = true;
  group.add(upperBody);

  // Interior floor, just inside the doorway.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(BOTTOM_RADIUS - 0.15, 16), trimMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = HULL_BASE_Y + 0.02;
  floor.receiveShadow = true;
  group.add(floor);

  // Warm interior light so the inside reads as a lit room through the doorway.
  const interiorLight = new THREE.PointLight('#ffd27a', 4.5, 12);
  interiorLight.position.set(0, HULL_BASE_Y + 1.6, -0.3);
  group.add(interiorLight);

  // Panel-seam rings, all up in the solid upper section so none of them
  // float across the open doorway.
  [0.55, 0.72, 0.9].forEach((t) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(hullRadiusAt(t) + 0.03, 0.06, 6, 20),
      trimMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = HULL_BASE_Y + HULL_HEIGHT * t;
    group.add(ring);
  });

  // Rounded nose cap.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(TOP_RADIUS, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hullMat);
  nose.position.y = HULL_BASE_Y + HULL_HEIGHT;
  nose.castShadow = true;
  group.add(nose);

  // Cockpit porthole — opposite side from the door, up in the solid section.
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

  // Landing legs: short angled struts with footpads — the hull now rests
  // low to the ground so the doorway lines up with actual walking height.
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

  group.scale.setScalar(SHIP_SCALE);
  return group;
}

function makeBeam(color) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true), material);
  const pulseMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), pulseMat);
  return { beam, pulse, material };
}

function angularDistance(a, b) {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

// A ring of overlapping circular colliders around the hull's widest point,
// skipping a wider wedge than the visual doorway so there's no invisible
// wall right at the opening — this is what makes the hull solid like the
// scattered rocks while still letting the player walk in through the door.
// Each point goes through placeOnSphere (the same call rocks/landmarks use)
// rather than a flat offset from the hub's own height — the ground a few
// units out from the hub can sit higher or lower than the hub itself, and a
// collider floating above (or sunk below) where the player's feet actually
// are never registers as a hit, letting them walk straight through.
function buildHullColliders(terrainMesh) {
  const wallRadius = BOTTOM_RADIUS * SHIP_SCALE;
  const segments = 16;
  const colliderRadius = 1.3;
  const gapHalfWidth = DOOR_ANGULAR_WIDTH / 2 + 0.15;
  const colliders = [];

  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    if (angularDistance(angle, DOOR_FACING_ANGLE) < gapHalfWidth) continue;

    const { position } = placeOnSphere(terrainMesh, Math.cos(angle) * wallRadius, Math.sin(angle) * wallRadius);
    colliders.push({ position, radius: colliderRadius });
  }
  return colliders;
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

  const beamOrigin = hubPosition.clone().addScaledVector(hubUp, (HULL_BASE_Y + HULL_HEIGHT * 0.5) * SHIP_SCALE);

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

  const colliders = buildHullColliders(terrainMesh);

  return { group, hull, beams, colliders };
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
