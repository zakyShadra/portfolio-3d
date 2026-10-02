import * as THREE from 'three';
import { heightAt } from './terrain.js';

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTree() {
  const group = new THREE.Group();

  const trunkHeight = 2.2 + Math.random() * 1.2;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, trunkHeight, 6),
    new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 1 }),
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  group.add(trunk);

  const foliageColor = new THREE.Color().setHSL(0.3 + Math.random() * 0.06, 0.45, 0.32 + Math.random() * 0.1);
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const radius = 1.6 - i * 0.4;
    const height = 1.8;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 7),
      new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.9 }),
    );
    cone.position.y = trunkHeight + i * 1.1;
    cone.castShadow = true;
    group.add(cone);
  }

  return group;
}

function makeRock() {
  const geometry = new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.8, 0);
  const material = new THREE.MeshStandardMaterial({ color: '#8a8a82', roughness: 1, flatShading: true });
  const rock = new THREE.Mesh(geometry, material);
  rock.scale.y *= 0.6 + Math.random() * 0.3;
  rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

export function scatterWorld(scene, noise2D, { count = 260, radius = 220, avoid = 18, seed = 99, avoidPoints = [], avoidPointRadius = 9 } = {}) {
  const rand = mulberry32(seed);
  const objects = [];

  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = avoid + rand() * (radius - avoid);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // Skip spots too close to a landmark/signpost so decor doesn't bury them.
    const tooClose = avoidPoints.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < avoidPointRadius ** 2);
    if (tooClose) continue;

    const y = heightAt(noise2D, x, z);

    // Fewer trees high up on "rocky" peaks, more rocks instead.
    const isHighAltitude = y > 9;
    const item = (!isHighAltitude && rand() < 0.75) ? makeTree() : makeRock();
    item.position.set(x, y, z);
    item.rotation.y = rand() * Math.PI * 2;
    const scale = 0.8 + rand() * 0.6;
    item.scale.multiplyScalar(scale);

    scene.add(item);
    objects.push(item);
  }

  return objects;
}
