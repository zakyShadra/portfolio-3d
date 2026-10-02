// Deterministic 2D value noise (no external dep) — same seed always
// produces the same terrain, so the world is reproducible.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createNoise2D(seed = 1337) {
  const rand = mulberry32(seed);
  const gridSize = 256;
  const gradients = new Float32Array(gridSize * gridSize * 2);
  for (let i = 0; i < gridSize * gridSize; i++) {
    const angle = rand() * Math.PI * 2;
    gradients[i * 2] = Math.cos(angle);
    gradients[i * 2 + 1] = Math.sin(angle);
  }

  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function gradAt(ix, iy, dx, dy) {
    const x = ((ix % gridSize) + gridSize) % gridSize;
    const y = ((iy % gridSize) + gridSize) % gridSize;
    const idx = (y * gridSize + x) * 2;
    return gradients[idx] * dx + gradients[idx + 1] * dy;
  }

  // Single-octave Perlin-style noise in roughly [-1, 1].
  function perlin(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const sx = fade(x - x0);
    const sy = fade(y - y0);

    const n00 = gradAt(x0, y0, x - x0, y - y0);
    const n10 = gradAt(x1, y0, x - x1, y - y0);
    const n01 = gradAt(x0, y1, x - x0, y - y1);
    const n11 = gradAt(x1, y1, x - x1, y - y1);

    const ix0 = n00 + sx * (n10 - n00);
    const ix1 = n01 + sx * (n11 - n01);
    return ix0 + sy * (ix1 - ix0);
  }

  // Fractal brownian motion: layers of perlin noise for natural-looking terrain.
  return function noise2D(x, y, octaves = 4, persistence = 0.5) {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += perlin(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  };
}
