import * as THREE from 'three';

const COLORS = {
  chassis: 0x2b2d33,
  trim: 0xff5c2e,
  visor: 0x8adfff,
  joint: 0x111214,
  tread: 0x3a3d42,
  rib: 0x9a9da4,
};

// A road wheel: a flat disc on a horizontal axle running left-right (world
// X), spinning face-on around that axle — the classic tank-wheel silhouette,
// not a long tube tumbling end over end. Bolt heads near the rim make the
// spin readable (a plain disc spinning on its own symmetric axis shows no
// visible motion without an off-center mark).
function makeWheel(radius, thickness, steelMat, boltMat) {
  const mount = new THREE.Group(); // static: positions this wheel on the robot

  const orient = new THREE.Group(); // static one-time turn: local Y axle -> world X
  orient.rotation.z = Math.PI / 2;
  mount.add(orient);

  const spinner = new THREE.Group(); // spins every frame: rotation.y = rollAngle
  orient.add(spinner);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 16), steelMat);
  disc.castShadow = true;
  disc.receiveShadow = true;
  spinner.add(disc);

  const BOLT_COUNT = 5;
  for (let i = 0; i < BOLT_COUNT; i++) {
    const phi = (i / BOLT_COUNT) * Math.PI * 2;
    const bx = Math.cos(phi) * radius * 0.62;
    const bz = Math.sin(phi) * radius * 0.62;
    [thickness / 2, -thickness / 2].forEach((by) => {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.11, 6, 6), boltMat);
      bolt.position.set(bx, by, bz);
      spinner.add(bolt);
    });
  }

  return { mount, spinner };
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

  // --- Wheels: a pair of road wheels per side, spinning face-on ----------
  const WHEEL_RADIUS = 0.38;
  const WHEEL_THICKNESS = 0.22;
  const WHEEL_X = 0.56;
  const WHEEL_Z = 0.3;

  function makeTreadSide(x) {
    const front = makeWheel(WHEEL_RADIUS, WHEEL_THICKNESS, treadMat, ribMat);
    front.mount.position.set(x, WHEEL_RADIUS, WHEEL_Z);
    root.add(front.mount);

    const back = makeWheel(WHEEL_RADIUS, WHEEL_THICKNESS, treadMat, ribMat);
    back.mount.position.set(x, WHEEL_RADIUS, -WHEEL_Z);
    root.add(back.mount);

    // Static fender bar tying the two wheels together visually.
    const fender = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, WHEEL_Z * 2 + WHEEL_RADIUS * 0.6),
      jointMat,
    );
    fender.position.set(x, WHEEL_RADIUS * 2 + 0.02, 0);
    fender.castShadow = true;
    root.add(fender);

    return [front.spinner, back.spinner];
  }

  const treadL = makeTreadSide(WHEEL_X);
  const treadR = makeTreadSide(-WHEEL_X);

  // --- Torso ------------------------------------------------------------
  const TORSO_Y = WHEEL_RADIUS * 2 + 0.425;
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
    root, torso, headGroup, treadL, treadR,
    eyeLensL: eyeL.userData.lens, eyeLensR: eyeR.userData.lens,
    armL, armR,
  };
}
