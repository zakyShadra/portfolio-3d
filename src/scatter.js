import * as THREE from 'three';
import { placeOnSphere } from './terrain.js';

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRock() {
  const baseRadius = 0.6 + Math.random() * 0.8;
  const geometry = new THREE.IcosahedronGeometry(baseRadius, 0);
  const grey = 0.45 + Math.random() * 0.25;
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(grey, grey, grey * 0.96),
    roughness: 1,
    flatShading: true,
  });
  const rock = new THREE.Mesh(geometry, material);
  rock.scale.y *= 0.6 + Math.random() * 0.3;
  rock.castShadow = true;
  rock.receiveShadow = true;
  rock.userData.baseRadius = baseRadius;
  return rock;
}

export function scatterWorld(scene, terrainMesh, { count = 260, radius = 220, avoid = 18, seed = 99, avoidPoints = [], avoidPointRadius = 9 } = {}) {
  const rand = mulberry32(seed);
  const objects = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = avoid + rand() * (radius - avoid);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // Skip spots too close to a landmark or the ship so decor doesn't bury them.
    const tooClose = avoidPoints.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < avoidPointRadius ** 2);
    if (tooClose) continue;

    const { position, dir } = placeOnSphere(terrainMesh, x, z);

    const item = makeRock();
    item.position.copy(position);
    // Stand the rock flush against the curved surface (local up -> surface normal),
    // then spin it randomly around that same normal for variety.
    item.quaternion.setFromUnitVectors(up, dir);
    item.rotateOnWorldAxis(dir, rand() * Math.PI * 2);
    const scale = 0.8 + rand() * 0.6;
    item.scale.multiplyScalar(scale);

    scene.add(item);
    // Horizontal (xz) collision radius only — squish/scale only affects height,
    // and that's all the player's tangent-plane collision check needs.
    objects.push({ mesh: item, position: position.clone(), radius: item.userData.baseRadius * scale });
  }

  return objects;
}
