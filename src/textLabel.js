import * as THREE from 'three';

// Renders text onto a canvas and returns a Three.js texture — used for
// billboard labels and holographic beam tags instead of loading a font/geometry lib.
export function makeTextTexture(lines, { width = 512, height = 160, bg = 'rgba(10,12,8,0.78)', fg = '#f4f1e6', accent = '#ffd27a' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, width, height, 24);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? accent : fg;
    ctx.font = i === 0 ? `bold ${Math.floor(height * 0.22)}px system-ui, sans-serif` : `${Math.floor(height * 0.14)}px system-ui, sans-serif`;
    const y = height * (0.32 + i * 0.26);
    ctx.fillText(line, width / 2, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
