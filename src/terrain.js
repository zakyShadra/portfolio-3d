import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The world is a small moon: a sphere you can walk all the way around and
// loop back to where you started, since "forward" is just travel along a
// great circle. The spawn point sits at the sphere's north pole, directly
// above its center, so existing "angle + arc-distance from spawn" layout
// math (landmark ring, scatter, the ship's beams) keeps working almost unchanged —
// see placeOnSphere below.
export const PLANET_RADIUS = 180;
export const PLANET_CENTER = new THREE.Vector3(0, -PLANET_RADIUS, 0);

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fixed set of lunar craters: random directions on the unit sphere, each
// with an angular radius (how wide it is, in radians of arc) and a depth.
// Generated once with its own seed so every query (mesh build, player
// ground-height check) agrees on the exact same craters.
function buildCraters(seed, count) {
  const rand = mulberry32(seed);
  const craters = [];
  for (let i = 0; i < count; i++) {
    const z = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const dir = new THREE.Vector3(r * Math.cos(t), z, r * Math.sin(t));
    // Mostly small craters with a handful of big ones (square bias towards 0).
    const angularRadius = THREE.MathUtils.lerp(0.028, 0.16, rand() * rand());
    const depth = angularRadius * PLANET_RADIUS * THREE.MathUtils.lerp(0.35, 0.6, rand());
    craters.push({ dir, angularRadius, depth });
  }
  return craters;
}

const CRATERS = buildCraters(2024, 50);

const RIM_OUTER = 1.4; // where the raised rim lip fades back to 0

// Normalized distance from crater center (0 = center, 1 = rim). Bowl-shaped
// pit from center to rim (ending exactly at 0, same as the untouched ground
// outside), then a raised lip from the rim out to RIM_OUTER that also starts
// and ends at exactly 0 — no jumps anywhere, so the physics ground-height
// query always agrees with what the mesh actually renders.
function craterProfile(d) {
  if (d <= 1) return d * d - 1;
  if (d < RIM_OUTER) return 0.25 * Math.sin((Math.PI * (d - 1)) / (RIM_OUTER - 1));
  return 0;
}

function craterElevation(dir) {
  let sum = 0;
  for (const c of CRATERS) {
    const cosAngle = THREE.MathUtils.clamp(dir.dot(c.dir), -1, 1);
    const angularDist = Math.acos(cosAngle);
    const d = angularDist / c.angularRadius;
    if (d < RIM_OUTER) sum += craterProfile(d) * c.depth;
  }
  return sum;
}

// Triplanar-blended noise: three 2D samples of the direction vector's axis
// pairs, blended by how face-on each pair is. Avoids the seams/pinching a
// plain lon/lat UV sample would produce at the poles of the sphere.
const NOISE_FREQ = 2.4;
const NOISE_AMP = 2.4;

function rollingNoise(noise2D, dir) {
  const px = dir.x * NOISE_FREQ;
  const py = dir.y * NOISE_FREQ;
  const pz = dir.z * NOISE_FREQ;
  const nYZ = noise2D(py, pz, 4, 0.5);
  const nZX = noise2D(pz, px, 4, 0.5);
  const nXY = noise2D(px, py, 4, 0.5);
  const ax = Math.abs(dir.x);
  const ay = Math.abs(dir.y);
  const az = Math.abs(dir.z);
  const weightSum = ax + ay + az || 1;
  return ((nYZ * ax + nZX * ay + nXY * az) / weightSum) * NOISE_AMP;
}

// dir must be a unit vector (direction from the planet's center).
export function elevationAt(noise2D, dir) {
  return rollingNoise(noise2D, dir) + craterElevation(dir);
}

// Ground queries go through this raycaster against the *actual rendered
// mesh*, not the continuous elevationAt() formula directly. The mesh is a
// coarse triangulated approximation of that formula, so a direct formula
// query can disagree with what's really drawn at a given spot (worst near
// small craters) — the player would then clip into or float above the
// visible ground. Raycasting the real geometry means physics always agrees
// with the picture on screen, regardless of mesh resolution.
const _raycaster = new THREE.Raycaster();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

// dir must be a unit vector (direction from the planet's center). Returns
// the exact point where the terrain mesh surface sits along that direction,
// and the planet-center-relative radius of that point.
export function groundRadiusAt(terrainMesh, dir) {
  _rayOrigin.copy(PLANET_CENTER).addScaledVector(dir, PLANET_RADIUS * 2);
  _rayDir.copy(dir).negate();
  _raycaster.set(_rayOrigin, _rayDir);
  _raycaster.far = PLANET_RADIUS * 3;
  const hits = _raycaster.intersectObject(terrainMesh, false);
  if (hits.length === 0) return PLANET_RADIUS; // shouldn't happen, but don't crash if it does
  return hits[0].point.distanceTo(PLANET_CENTER);
}

// Converts the old flat-world "x/z anchor" convention (angle = atan2(z, x),
// distance = arc length from the spawn pole) into an actual point on the
// sphere, so landmark rings / scatter / the ship can keep using the
// same angle+distance placement logic they always have.
export function placeOnSphere(terrainMesh, x, z) {
  const arc = Math.hypot(x, z);
  const theta = arc / PLANET_RADIUS;
  const azimuth = Math.atan2(z, x);
  const dir = new THREE.Vector3(
    Math.sin(theta) * Math.cos(azimuth),
    Math.cos(theta),
    Math.sin(theta) * Math.sin(azimuth),
  );
  const radius = groundRadiusAt(terrainMesh, dir);
  const position = PLANET_CENTER.clone().addScaledVector(dir, radius);
  return { position, dir };
}

export function createTerrain(noise2D, detail = 32) {
  let geometry = new THREE.IcosahedronGeometry(PLANET_RADIUS, detail);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);

  const deepColor = new THREE.Color('#3f3f46'); // crater-floor shadow
  const lowColor = new THREE.Color('#8c8a86'); // regolith grey
  const highColor = new THREE.Color('#dedad0'); // sunlit highland / crater rim dust

  const dir = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    dir.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
    const elevation = elevationAt(noise2D, dir);
    const radius = PLANET_RADIUS + elevation;
    position.setXYZ(i, dir.x * radius, dir.y * radius, dir.z * radius);

    const t = THREE.MathUtils.clamp((elevation + 6) / 12, 0, 1);
    const color = t < 0.5
      ? deepColor.clone().lerp(lowColor, t * 2)
      : lowColor.clone().lerp(highColor, (t - 0.5) * 2);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // IcosahedronGeometry comes out non-indexed (duplicate verts per face, flat
  // shaded). Weld the shared edges back together so normals/lighting are smooth.
  geometry = mergeVertices(geometry);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(PLANET_CENTER);
  mesh.receiveShadow = true;
  // Ground queries (placeOnSphere, groundRadiusAt) raycast this mesh using
  // its matrixWorld, and they run as soon as the world is built — before
  // the scene has ever gone through a render pass, which is normally what
  // applies `position` to `matrixWorld`. Force it now so the very first
  // query already sees the real translated geometry.
  mesh.updateMatrixWorld(true);
  return mesh;
}
