import * as THREE from 'three';

// Deep-space skybox: a starfield with faint nebula haze, painted onto a
// canvas texture (not a shader) so it stays easy to read/tweak.
export function createSky() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#01020a');
  gradient.addColorStop(0.5, '#0a0e22');
  gradient.addColorStop(1, '#01020a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Soft nebula haze — a handful of large, low-opacity radial blobs.
  const nebulaColors = ['86,70,160', '60,110,150', '140,70,110'];
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * width;
    const y = height * 0.2 + Math.random() * height * 0.6;
    const r = 70 + Math.random() * 160;
    const rgb = nebulaColors[i % nebulaColors.length];
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb},0.22)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Starfield: mostly tiny dim stars, a few bright standouts.
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const bright = Math.random() < 0.08;
    const size = bright ? 0.9 + Math.random() * 1.4 : 0.3 + Math.random() * 0.6;
    const alpha = bright ? 0.7 + Math.random() * 0.3 : 0.35 + Math.random() * 0.4;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.SphereGeometry(500, 32, 20);
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(geometry, material);
}
