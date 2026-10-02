import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { ALL_POINTS } from './content.js';
import { makeTextTexture } from './textLabel.js';

const RING_RADIUS = 95;
const TRIGGER_RADIUS = 7;

const KIND_COLOR = {
  about: '#ffd27a',
  contact: '#8adfff',
  project: '#ff8a5c',
};

function makeCrystal(color) {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4, 0),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.2 }),
  );
  core.scale.y = 2.2;
  core.position.y = 2.6;
  core.castShadow = true;
  group.add(core);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.9, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: '#4a4a46', roughness: 0.9 }),
  );
  base.position.y = 0.3;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Thin vertical beacon so the landmark is visible from far across the map.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 40, 6, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  beacon.position.y = 20.6;
  group.add(beacon);

  const light = new THREE.PointLight(color, 2, 18);
  light.position.y = 2.6;
  group.add(light);

  group.userData.core = core;
  return group;
}

export function buildLandmarks(scene, noise2D) {
  const landmarks = [];
  const count = ALL_POINTS.length;

  ALL_POINTS.forEach((data, i) => {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * RING_RADIUS;
    const z = Math.sin(angle) * RING_RADIUS;
    const y = heightAt(noise2D, x, z);

    const color = KIND_COLOR[data.kind] ?? '#ffffff';
    const crystal = makeCrystal(color);
    crystal.position.set(x, y, z);
    scene.add(crystal);

    const labelTexture = makeTextTexture([
      data.kind === 'project' ? `${data.index} · ${data.title}` : data.title,
      data.subtitle ?? (data.tags ? data.tags.join(' · ') : ''),
    ]);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false }));
    label.scale.set(7, 2.2, 1);
    label.position.set(x, y + 6.2, z);
    scene.add(label);

    landmarks.push({
      data,
      position: new THREE.Vector3(x, y, z),
      angle,
      object: crystal,
      label,
      triggerRadius: TRIGGER_RADIUS,
      bobSeed: Math.random() * Math.PI * 2,
    });
  });

  return landmarks;
}

export function animateLandmarks(landmarks, elapsed) {
  landmarks.forEach((lm) => {
    const core = lm.object.userData.core;
    core.rotation.y = elapsed * 0.6 + lm.bobSeed;
    core.position.y = 2.6 + Math.sin(elapsed * 1.4 + lm.bobSeed) * 0.25;
  });
}
