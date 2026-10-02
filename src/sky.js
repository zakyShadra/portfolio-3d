import * as THREE from 'three';

// Vertical-gradient sky dome, painted with a canvas texture instead of a
// shader so it's easy to read/tweak without touching GLSL.
export function createSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#2b6cd4');
  gradient.addColorStop(0.5, '#9fd0e8');
  gradient.addColorStop(1, '#e8f3e0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);

  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.SphereGeometry(400, 24, 16);
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(geometry, material);
}

export function createClouds(count = 18, radius = 260) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });

  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 3, 8, 8), material);
      puff.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6);
      cloud.add(puff);
    }
    const angle = Math.random() * Math.PI * 2;
    cloud.position.set(Math.cos(angle) * radius, 60 + Math.random() * 30, Math.sin(angle) * radius);
    cloud.userData.driftSpeed = 0.5 + Math.random() * 0.8;
    group.add(cloud);
  }

  return group;
}

export function animateClouds(cloudGroup, dt) {
  cloudGroup.children.forEach((cloud) => {
    cloud.position.x += cloud.userData.driftSpeed * dt;
    if (cloud.position.x > 300) cloud.position.x = -300;
  });
}
