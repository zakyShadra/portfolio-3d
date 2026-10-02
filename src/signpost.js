import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { makeTextTexture } from './textLabel.js';

const ARM_GAP = 0.85;
const ARM_START_Y = 2.2;

function makeArrow(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });

  const shaftLength = 1.7;
  const tipLength = 0.6;

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, shaftLength), material);
  shaft.position.z = -shaftLength / 2;
  shaft.castShadow = true;
  group.add(shaft);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, tipLength, 4), material);
  tip.rotation.x = -Math.PI / 2;
  tip.rotation.y = Math.PI / 4; // square cone edge-aligned instead of face-on
  tip.position.z = -shaftLength - tipLength / 2 + 0.1;
  tip.castShadow = true;
  group.add(tip);

  return group;
}

// A central hub signpost: one arm per landmark, each physically rotated
// (via lookAt) so it points toward that landmark's real world direction.
export function buildSignpost(scene, noise2D, landmarks) {
  const hubY = heightAt(noise2D, 0, 0);
  const hub = new THREE.Group();
  hub.position.set(0, hubY, 0);
  scene.add(hub);

  const poleHeight = ARM_START_Y + landmarks.length * ARM_GAP + 0.6;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, poleHeight, 8),
    new THREE.MeshStandardMaterial({ color: '#5a4530', roughness: 0.95 }),
  );
  pole.position.y = poleHeight / 2;
  pole.castShadow = true;
  hub.add(pole);

  const kindColor = { about: '#ffd27a', contact: '#8adfff', project: '#9fd48a' };

  landmarks.forEach((lm, i) => {
    const arm = makeArrow(kindColor[lm.data.kind] ?? '#cccccc');
    arm.position.y = ARM_START_Y + i * ARM_GAP;
    hub.add(arm);

    // Keep the arm level — look at the landmark's position flattened to the arm's own height.
    const target = new THREE.Vector3(lm.position.x, hubY + arm.position.y, lm.position.z);
    arm.lookAt(target);

    const label = lm.data.kind === 'project'
      ? `${lm.data.index} ${lm.data.title}`
      : lm.data.title;
    const texture = makeTextTexture([label], { width: 384, height: 96, bg: 'rgba(10,12,8,0.7)' });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(3.2, 0.8, 1);
    // Child of the arm (not the hub) so it floats above *that* arrow, in
    // the direction the arrow itself was just rotated to point.
    sprite.position.set(0, 0.55, -0.9);
    arm.add(sprite);
  });

  return hub;
}
