import * as THREE from 'three';

const DISTANCE = 130; // far enough to read as "in the sky", still inside the skybox radius

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// A visible sun — a bright disc plus a soft glow halo — that tracks the
// DirectionalLight's direction every frame, so players can tell where
// "noon" is at a glance instead of just inferring it from ambient light.
// It's a real object in the scene, so the moon's own curved horizon
// naturally occludes it at night instead of needing a fake sunset fade.
export function createSun() {
  const group = new THREE.Group();

  const coreMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false });
  const core = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), coreMat);
  group.add(core);

  const glowMat = new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: '#fff3d6', transparent: true, fog: false,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(40, 40, 1);
  group.add(glow);

  group.userData.coreMat = coreMat;
  group.userData.glowMat = glowMat;
  return group;
}

// anchorPosition: the point the sun should appear to shine from the far
// side of (the player), so it reads as "over there" relative to where
// you're standing rather than drifting with the camera's orbit.
export function updateSun(sunVisual, directionalLight, anchorPosition) {
  const dir = directionalLight.position.clone().sub(directionalLight.target.position).normalize();
  sunVisual.position.copy(anchorPosition).addScaledVector(dir, DISTANCE);

  sunVisual.userData.coreMat.color.copy(directionalLight.color);
  sunVisual.userData.glowMat.color.copy(directionalLight.color);
  sunVisual.userData.glowMat.opacity = THREE.MathUtils.clamp(directionalLight.intensity / 1.6, 0.15, 1);
}
