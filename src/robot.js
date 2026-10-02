import * as THREE from 'three';

const COLORS = {
  chassis: 0x2b2d33,
  trim: 0xff5c2e,
  visor: 0x8adfff,
  joint: 0x111214,
};

function makeLimb({ upperLen, lowerLen, radius, footSize }, chassisMat, trimMat, jointMat) {
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

  const foot = new THREE.Mesh(new THREE.BoxGeometry(footSize, footSize * 0.6, footSize * 1.3), trimMat);
  foot.position.y = -lowerLen - footSize * 0.3;
  foot.position.z = footSize * 0.25;
  foot.castShadow = true;
  elbow.add(foot);

  return { root, elbow };
}

// Builds the low-poly explorer rig. Local origin sits exactly at foot level
// so it drops straight into Player's existing ground-contact logic.
export function buildRobot() {
  const chassisMat = new THREE.MeshStandardMaterial({ color: COLORS.chassis, roughness: 0.55, metalness: 0.35 });
  const trimMat = new THREE.MeshStandardMaterial({ color: COLORS.trim, roughness: 0.4, metalness: 0.2, emissive: COLORS.trim, emissiveIntensity: 0.15 });
  const jointMat = new THREE.MeshStandardMaterial({ color: COLORS.joint, roughness: 0.7, metalness: 0.4 });
  const visorMat = new THREE.MeshStandardMaterial({ color: COLORS.visor, emissive: COLORS.visor, emissiveIntensity: 0.9, roughness: 0.3 });

  const root = new THREE.Group();

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 1.05, 6), chassisMat);
  torso.position.y = 1.59;
  torso.castShadow = true;
  root.add(torso);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.1), trimMat);
  chestPlate.position.set(0, 1.66, 0.42);
  root.add(chestPlate);

  const headGroup = new THREE.Group();
  headGroup.position.y = 2.29;
  root.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.5), chassisMat);
  head.castShadow = true;
  headGroup.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06), visorMat);
  visor.position.set(0, 0.02, 0.26);
  headGroup.add(visor);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), jointMat);
  antenna.position.set(0, 0.38, 0);
  headGroup.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), trimMat);
  antennaTip.position.set(0, 0.54, 0);
  headGroup.add(antennaTip);

  const armL = makeLimb({ upperLen: 0.46, lowerLen: 0.4, radius: 0.1, footSize: 0.14 }, chassisMat, trimMat, jointMat);
  armL.root.position.set(0.56, 1.96, 0);
  root.add(armL.root);

  const armR = makeLimb({ upperLen: 0.46, lowerLen: 0.4, radius: 0.1, footSize: 0.14 }, chassisMat, trimMat, jointMat);
  armR.root.position.set(-0.56, 1.96, 0);
  root.add(armR.root);

  const legL = makeLimb({ upperLen: 0.5, lowerLen: 0.46, radius: 0.15, footSize: 0.22 }, chassisMat, trimMat, jointMat);
  legL.root.position.set(0.24, 1.09, 0);
  root.add(legL.root);

  const legR = makeLimb({ upperLen: 0.5, lowerLen: 0.46, radius: 0.15, footSize: 0.22 }, chassisMat, trimMat, jointMat);
  legR.root.position.set(-0.24, 1.09, 0);
  root.add(legR.root);

  return { root, torso, headGroup, visor, visorMat, antennaTip, armL, armR, legL, legR };
}
