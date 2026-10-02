import * as THREE from 'three';

const SCALE = 0.015; // how "zoomed in" the noise is — smaller = wider hills
const HEIGHT = 18;

export function heightAt(noise2D, x, z) {
  return noise2D(x * SCALE, z * SCALE, 5, 0.5) * HEIGHT;
}

export function createTerrain(noise2D, size = 500, segments = 220) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const low = new THREE.Color('#3f6b3a');
  const mid = new THREE.Color('#6b8f4e');
  const high = new THREE.Color('#dce3c8');

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = heightAt(noise2D, x, z);
    position.setY(i, y);

    const t = THREE.MathUtils.clamp((y + HEIGHT * 0.3) / (HEIGHT * 1.1), 0, 1);
    const color = t < 0.5
      ? low.clone().lerp(mid, t * 2)
      : mid.clone().lerp(high, (t - 0.5) * 2);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
