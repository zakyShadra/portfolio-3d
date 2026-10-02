import * as THREE from 'three';

const COLORS = {
  chassis: 0x2b2d33,
  trim: 0xff5c2e,
  visor: 0x8adfff,
  joint: 0x111214,
  tread: 0x3a3d42,
  rib: 0x9a9da4,
};

// A steel roller drum with ribs running its length, mounted on static axle
// caps. Only the inner "rotor" spins — around the drum's own axle, not its
// long axis — so it reads as a rolling tank wheel, not a motionless capsule.
function makeTreadUnit(radius, length, treadMat, ribMat, jointMat) {
  const mount = new THREE.Group(); // static: positions the whole wheel on the robot

  const rotor = new THREE.Group(); // spins every frame: rotation.x = PI/2 (layout) + rollAngle
  rotor.rotation.x = Math.PI / 2;
  mount.add(rotor);

  const drum = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 12), treadMat);
  drum.castShadow = true;
  drum.receiveShadow = true;
  rotor.add(drum);

  const RIB_COUNT = 6;
  for (let i = 0; i < RIB_COUNT; i++) {
    const phi = (i / RIB_COUNT) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.05, length + radius * 0.3, radius * 0.22), ribMat);
    rib.position.set(Math.cos(phi) * radius * 0.96, 0, Math.sin(phi) * radius * 0.96);
    rib.rotation.y = -phi;
    rib.castShadow = true;
    rotor.add(rib);
  }

  // Static axle caps, built directly in mount's (unrotated) frame where Z
  // is already the wheel's length axis — these never spin.
  const capGeo = new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, 0.06, 10);
  const capFront = new THREE.Mesh(capGeo, jointMat);
  capFront.rotation.x = Math.PI / 2;
  capFront.position.z = length / 2 + radius * 0.5;
  mount.add(capFront);
  const capBack = capFront.clone();
  capBack.position.z = -(length / 2 + radius * 0.5);
  mount.add(capBack);

  return { mount, rotor };
}

function makeArm({ upperLen, lowerLen, radius }, chassisMat, trimMat, jointMat) {
  const root = new THREE.Group();

  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.15, 10, 10), jointMat);
  shoulder.castShadow = true;
  root.add(shoulder);

  const upper = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, upperLen, 6), chassisMat);
  upper.position.y = -upperLen / 2;
  upper.castShadow = true;
  root.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -upperLen;
  root.add(elbow);

  const jointBall = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), jointMat);
  elbow.add(jointBall);

  const lower = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius * 0.7, lowerLen, 6), chassisMat);
  lower.position.y = -lowerLen / 2;
  lower.castShadow = true;
  elbow.add(lower);

  const claw = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.2, radius * 1.1, radius * 1.4), trimMat);
  claw.position.y = -lowerLen - radius * 0.5;
  claw.castShadow = true;
  elbow.add(claw);

  return { root, elbow };
}

// Footless, tread-rolling explorer rig (WALL-E-inspired mechanism — tank
// treads + a binocular eye head — in our own low-poly style, not a literal
// copy of the copyrighted character design). Local origin sits at tread
// contact level so it drops straight into Player's ground-contact logic.
export function buildRobot() {
  const chassisMat = new THREE.MeshStandardMaterial({ color: COLORS.chassis, roughness: 0.55, metalness: 0.35 });
  const trimMat = new THREE.MeshStandardMaterial({ color: COLORS.trim, roughness: 0.4, metalness: 0.2, emissive: COLORS.trim, emissiveIntensity: 0.15 });
  const jointMat = new THREE.MeshStandardMaterial({ color: COLORS.joint, roughness: 0.7, metalness: 0.4 });
  const visorMat = new THREE.MeshStandardMaterial({ color: COLORS.visor, emissive: COLORS.visor, emissiveIntensity: 0.9, roughness: 0.3 });
  const treadMat = new THREE.MeshStandardMaterial({ color: COLORS.tread, roughness: 0.4, metalness: 0.6 });
  const ribMat = new THREE.MeshStandardMaterial({ color: COLORS.rib, roughness: 0.3, metalness: 0.7 });

  const root = new THREE.Group();

  // --- Treads: steel roller wheels with spinning ribs -------------------
  const TREAD_RADIUS = 0.32;
  const TREAD_LEN = 0.7;
  const TREAD_X = 0.58;

  const treadUnitL = makeTreadUnit(TREAD_RADIUS, TREAD_LEN, treadMat, ribMat, jointMat);
  treadUnitL.mount.position.set(TREAD_X, TREAD_RADIUS, 0);
  root.add(treadUnitL.mount);

  const treadUnitR = makeTreadUnit(TREAD_RADIUS, TREAD_LEN, treadMat, ribMat, jointMat);
  treadUnitR.mount.position.set(-TREAD_X, TREAD_RADIUS, 0);
  root.add(treadUnitR.mount);

  // --- Torso ------------------------------------------------------------
  const TORSO_Y = 1.06;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 0.85), chassisMat);
  torso.position.y = TORSO_Y;
  torso.castShadow = true;
  root.add(torso);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.08), trimMat);
  chestPlate.position.set(0, TORSO_Y + 0.05, 0.445);
  root.add(chestPlate);

  // --- Neck + binocular head --------------------------------------------
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 8), jointMat);
  neck.position.y = TORSO_Y + 0.425 + 0.11;
  root.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.y = neck.position.y + 0.11 + 0.14;
  root.add(headGroup);

  const headShell = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.42), chassisMat);
  headShell.castShadow = true;
  headGroup.add(headShell);

  function makeEye() {
    const eye = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.28, 10), chassisMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.14;
    barrel.castShadow = true;
    eye.add(barrel);

    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), visorMat);
    lens.scale.z = 0.5;
    lens.position.z = 0.29;
    eye.add(lens);

    eye.userData.lens = lens;
    return eye;
  }

  const eyeL = makeEye();
  eyeL.position.set(0.16, 0.01, 0.18);
  headGroup.add(eyeL);

  const eyeR = makeEye();
  eyeR.position.set(-0.16, 0.01, 0.18);
  headGroup.add(eyeR);

  // --- Arms ---------------------------------------------------------------
  const armL = makeArm({ upperLen: 0.44, lowerLen: 0.38, radius: 0.1 }, chassisMat, trimMat, jointMat);
  armL.root.position.set(0.58, TORSO_Y + 0.26, 0);
  root.add(armL.root);

  const armR = makeArm({ upperLen: 0.44, lowerLen: 0.38, radius: 0.1 }, chassisMat, trimMat, jointMat);
  armR.root.position.set(-0.58, TORSO_Y + 0.26, 0);
  root.add(armR.root);

  return {
    root, torso, headGroup,
    treadL: treadUnitL.rotor, treadR: treadUnitR.rotor,
    eyeLensL: eyeL.userData.lens, eyeLensR: eyeR.userData.lens,
    armL, armR,
  };
}
