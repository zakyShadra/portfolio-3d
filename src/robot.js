import * as THREE from 'three';
import { ARM_REST_X } from './robotAnimator.js';

const COLORS = {
  chassis: 0x2b2d33,
  trim: 0xff5c2e,
  visor: 0x8adfff,
  joint: 0x111214,
  tread: 0x6b4a2f,
  rib: 0xb8bcc2,
};

// Outward offset of a triangle (a true 2D "buffer" by `offset`, like
// inflating it with a disk of that radius) — each edge is pushed straight
// out along its own outward normal, and each corner is rounded with an arc
// of radius `offset` connecting the two offset edges (sampled into
// `segments` steps). Because every edge moves out by the exact same
// distance, the result hugs the original triangle uniformly tight — unlike
// scaling from the centroid, which overshoots the far corners just to
// clear the near one. pts are {y,z} triangle corners in loop order.
function offsetRoundedTriangleOutline(pts, offset, segments) {
  const n = pts.length;
  const centroid = { y: 0, z: 0 };
  pts.forEach((p) => { centroid.y += p.y / n; centroid.z += p.z / n; });

  const edgeNormals = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dy, dz);
    let ny = dz / len;
    let nz = -dy / len;
    const mid = { y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    if (ny * (mid.y - centroid.y) + nz * (mid.z - centroid.z) < 0) { ny *= -1; nz *= -1; }
    return { y: ny, z: nz };
  });

  const outline = [];
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const normalPrev = edgeNormals[(i - 1 + n) % n]; // edge ending at cur
    const normalNext = edgeNormals[i]; // edge starting at cur
    const a = { y: cur.y + normalPrev.y * offset, z: cur.z + normalPrev.z * offset };
    const b = { y: cur.y + normalNext.y * offset, z: cur.z + normalNext.z * offset };

    outline.push(a);
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      let vy = normalPrev.y * (1 - t) + normalNext.y * t;
      let vz = normalPrev.z * (1 - t) + normalNext.z * t;
      const vlen = Math.hypot(vy, vz);
      outline.push({ y: cur.y + (vy / vlen) * offset, z: cur.z + (vz / vlen) * offset });
    }
    outline.push(b);
  }
  return outline;
}

// Extrudes a closed 2D outline (array of {y,z}, local X = 0) into a thin
// prism of the given thickness along local X — a front cap, back cap, and
// a side wall quad per outline edge.
function prismFromOutline(outline, thickness) {
  const m = outline.length;
  const half = thickness / 2;
  const positions = [];
  for (const p of outline) positions.push(half, p.y, p.z);
  for (const p of outline) positions.push(-half, p.y, p.z);

  const indices = [];
  for (let i = 1; i < m - 1; i++) indices.push(0, i, i + 1); // front cap fan
  for (let i = 1; i < m - 1; i++) indices.push(m, m + i + 1, m + i); // back cap fan
  for (let i = 0; i < m; i++) {
    const ni = (i + 1) % m;
    indices.push(i, m + i, m + ni, i, m + ni, ni); // side wall quad
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// A road wheel: a flat disc on a horizontal axle running left-right (world
// X), spinning face-on around that axle — the classic tank-wheel silhouette,
// not a long tube tumbling end over end. Bolt heads near the rim make the
// spin readable (a plain disc spinning on its own symmetric axis shows no
// visible motion without an off-center mark).
function makeWheel(radius, thickness, steelMat, boltMat) {
  const mount = new THREE.Group(); // static: positions this wheel on the robot

  const orient = new THREE.Group(); // static one-time turn: local Y axle -> world X
  orient.rotation.z = Math.PI / 2;
  mount.add(orient);

  const spinner = new THREE.Group(); // spins every frame: rotation.y = rollAngle
  orient.add(spinner);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, 16), steelMat);
  disc.castShadow = true;
  disc.receiveShadow = true;
  spinner.add(disc);

  const BOLT_COUNT = 5;
  for (let i = 0; i < BOLT_COUNT; i++) {
    const phi = (i / BOLT_COUNT) * Math.PI * 2;
    const bx = Math.cos(phi) * radius * 0.62;
    const bz = Math.sin(phi) * radius * 0.62;
    [thickness / 2, -thickness / 2].forEach((by) => {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.11, 6, 6), boltMat);
      bolt.position.set(bx, by, bz);
      spinner.add(bolt);
    });
  }

  return { mount, spinner };
}

function makeArm({ upperLen, lowerLen, radius }, chassisMat, trimMat, jointMat) {
  const root = new THREE.Group();

  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.15, 10, 10), jointMat);
  shoulder.castShadow = true;
  root.add(shoulder);

  const upper = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, upperLen, 6), chassisMat);
  upper.position.y = -upperLen / 2;
  upper.castShadow = true;
  root.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = -upperLen;
  root.add(elbow);

  const jointBall = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), jointMat);
  elbow.add(jointBall);

  const lower = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius * 0.7, lowerLen, 6), chassisMat);
  lower.position.y = -lowerLen / 2;
  lower.castShadow = true;
  elbow.add(lower);

  const claw = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.2, radius * 1.1, radius * 1.4), trimMat);
  claw.position.y = -lowerLen - radius * 0.5;
  claw.castShadow = true;
  elbow.add(claw);

  return { root, elbow };
}

// Footless, tread-rolling explorer rig (WALL-E-inspired mechanism — tank
// treads + a binocular eye head — in our own low-poly style, not a literal
// copy of the copyrighted character design). Local origin sits at tread
// contact level so it drops straight into Player's ground-contact logic.
export function buildRobot() {
  const chassisMat = new THREE.MeshStandardMaterial({ color: COLORS.chassis, roughness: 0.55, metalness: 0.35 });
  const trimMat = new THREE.MeshStandardMaterial({ color: COLORS.trim, roughness: 0.4, metalness: 0.2, emissive: COLORS.trim, emissiveIntensity: 0.15 });
  const jointMat = new THREE.MeshStandardMaterial({ color: COLORS.joint, roughness: 0.7, metalness: 0.4 });
  const visorMat = new THREE.MeshStandardMaterial({ color: COLORS.visor, emissive: COLORS.visor, emissiveIntensity: 0.9, roughness: 0.3 });
  const treadMat = new THREE.MeshStandardMaterial({ color: COLORS.tread, roughness: 0.85, metalness: 0.1 });
  const ribMat = new THREE.MeshStandardMaterial({ color: COLORS.rib, roughness: 0.3, metalness: 0.7 });

  const root = new THREE.Group();

  // --- Suspension + tracks -------------------------------------------------
  // Each side's track is NOT welded to the body. It hangs off a real
  // mechanical chain: a pivot fixed to the body (rotates — the "leg" joint)
  // -> a rigid arm -> a shock housing -> the track module (wheels + band),
  // which slides along the shock's axis (a real prismatic joint, not a
  // scaled mesh). A visible rod always bridges the housing to the track so
  // the two halves read as one connected leg at any amount of travel.
  // Reference: the sketch's "double see-saw" drivetrain + vertical-travel
  // suspension that folds the whole assembly into a compact space.
  const WHEEL_RADIUS = 0.15;
  const WHEEL_THICKNESS = 0.24;
  const WHEEL_X = 0.56;
  const TRIANGLE_BASE = 1.0; // front-back distance between the two bottom wheels
  const TRIANGLE_APEX_HEIGHT = 0.6; // how far the top idler sits above the bottom pair
  const TRIANGLE_APEX_Z = -0.5; // pulled back off-center so it doesn't sit where the arm hangs (z=0)

  const ARM_LEN = 0.22;
  const PIVOT_Y = WHEEL_RADIUS + ARM_LEN; // rest: arm hangs straight down, wheel centers land at WHEEL_RADIUS

  function buildSuspensionSide(x) {
    const pivot = new THREE.Group(); // the body-side joint — this is what actually rotates
    pivot.position.set(x, PIVOT_Y, 0);
    root.add(pivot);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, ARM_LEN, 6), jointMat);
    arm.position.y = -ARM_LEN / 2;
    arm.castShadow = true;
    pivot.add(arm);

    const shockMount = new THREE.Group(); // fixed to the arm's far end
    shockMount.position.y = -ARM_LEN;
    pivot.add(shockMount);

    const shockHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 8), ribMat);
    shockHousing.castShadow = true;
    shockMount.add(shockHousing);

    // The piston rod: a thin cylinder that always spans from the housing to
    // the track module, however far apart the jump animation pushes them.
    const shockRod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), jointMat);
    shockRod.scale.y = 0.001;
    shockMount.add(shockRod);

    const trackModule = new THREE.Group(); // slides along local Y inside the shock — the jump's prismatic joint
    shockMount.add(trackModule);

    // Triangular bogie: two wheels at the bottom (front/back, ground
    // contact) and one idler wheel up top-center — the "double see-saw"
    // triangular drivetrain from the reference sketch, not a straight
    // in-line row of wheels.
    const wheelLayout = [
      { y: 0, z: TRIANGLE_BASE / 2 }, // bottom-front
      { y: 0, z: -TRIANGLE_BASE / 2 }, // bottom-back
      { y: TRIANGLE_APEX_HEIGHT, z: TRIANGLE_APEX_Z }, // top idler, offset clear of the arm
    ];

    const spinners = [];
    wheelLayout.forEach((p) => {
      const wheel = makeWheel(WHEEL_RADIUS, WHEEL_THICKNESS, ribMat, jointMat);
      wheel.mount.position.set(0, p.y, p.z);
      trackModule.add(wheel.mount);
      spinners.push(wheel.spinner);
    });

    // Cover plate: one single flat triangular shield spanning the whole
    // wheel triangle — a real triangle mesh (3 corners, lightly rounded), not
    // three overlapping planks, so the corners read as one continuous
    // shape instead of segmented/broken joints. This is what actually
    // covers the wheels from the side; it sits in front of the thin
    // background band below (which stays as the structural housing) and
    // behind the scrolling cleats (which give it the line detail so the
    // cover doesn't read as one bold solid slab).
    const COVER_THICKNESS = WHEEL_THICKNESS; // cover width = wheel width, exactly
    const COVER_MARGIN = WHEEL_RADIUS * 1.1; // uniform offset past the wheel's own radius — just enough to cover it, nothing more
    const coverOutline = offsetRoundedTriangleOutline(wheelLayout, COVER_MARGIN, 4);
    const coverGeo = prismFromOutline(coverOutline, COVER_THICKNESS);
    const coverMat = treadMat.clone();
    coverMat.side = THREE.DoubleSide;
    const coverPlate = new THREE.Mesh(coverGeo, coverMat);
    coverPlate.castShadow = true;
    trackModule.add(coverPlate);

    // The cover plate's own outline (not the small background triangle
    // below) is what the scrolling cleats ride on, so the moving line
    // detail sits on the cover itself, following it smoothly through the
    // rounded corners too.
    const coverEdges = coverOutline.map((a, i) => {
      const b = coverOutline[(i + 1) % coverOutline.length];
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      return { a, b, dy, dz, len: Math.hypot(dy, dz), angle: Math.atan2(dz, dy) };
    });
    const coverPerimeter = coverEdges.reduce((sum, e) => sum + e.len, 0);

    // Track band: one continuous tread wrapping all three wheels — like a
    // real tank/WALL-E track. Built from flat straight planks (not rounded
    // capsules) so the loop reads as a sharp-cornered triangle; each plank
    // runs a bit long past its two wheels so neighboring sides overlap into
    // a pointed joint instead of a gap. Kept thin (narrower than the wheel)
    // so the silver wheel disc still shows through on both faces, with dark
    // cleats that scroll around the whole loop in sync with the wheel roll
    // so the tread visibly moves rather than sitting painted on a static
    // housing.
    const BAND_WIDTH = WHEEL_THICKNESS * 0.5; // X: thin — narrower than the wheel, which stays visible
    const BAND_DEPTH = WHEEL_RADIUS * 1.3; // Z: flat-plank depth, just past the wheel's own radius
    const BAND_OVERLAP = WHEEL_RADIUS * 0.5; // extra length each end so sides overlap into a sharp point
    const edges = [[0, 1], [1, 2], [2, 0]].map(([ia, ib]) => {
      const a = wheelLayout[ia];
      const b = wheelLayout[ib];
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const len = Math.hypot(dy, dz);
      const angle = Math.atan2(dz, dy);

      const seg = new THREE.Mesh(new THREE.BoxGeometry(BAND_WIDTH, len + BAND_OVERLAP * 2, BAND_DEPTH), treadMat);
      seg.rotation.x = angle;
      seg.position.set(0, (a.y + b.y) / 2, (a.z + b.z) / 2);
      seg.castShadow = true;
      trackModule.add(seg);

      return { a, b, dy, dz, len, angle };
    });

    // Cleats live on the cover plate's loop as a whole (not on one edge),
    // each tagged with a fixed offset around its perimeter; updateBelt()
    // below slides every cleat along by the same amount each frame,
    // wrapping edge to edge, so they read as one belt rolling around the
    // cover instead of lines painted in place.
    const CLEAT_SPACING = 0.1;
    const cleatCount = Math.max(6, Math.round(coverPerimeter / CLEAT_SPACING));
    const cleatGeo = new THREE.BoxGeometry(COVER_THICKNESS + 0.03, 0.035, 0.12);
    const cleats = [];
    for (let i = 0; i < cleatCount; i++) {
      const cleat = new THREE.Mesh(cleatGeo, jointMat);
      cleat.castShadow = true;
      cleat.userData.baseOffset = (i / cleatCount) * coverPerimeter;
      trackModule.add(cleat);
      cleats.push(cleat);
    }

    function placeCleatAt(cleat, s) {
      let rem = ((s % coverPerimeter) + coverPerimeter) % coverPerimeter;
      for (let i = 0; i < coverEdges.length; i++) {
        const e = coverEdges[i];
        if (rem <= e.len || i === coverEdges.length - 1) {
          const t = e.len === 0 ? 0 : Math.min(1, rem / e.len);
          cleat.position.set(0, e.a.y + e.dy * t, e.a.z + e.dz * t);
          cleat.rotation.x = e.angle;
          return;
        }
        rem -= e.len;
      }
    }

    // rollAngle is the same value driving the wheel spinners; multiplying
    // by the wheel radius converts it to belt travel distance, so the tread
    // always scrolls at the same visual speed the wheels are turning at.
    function updateBelt(rollAngle) {
      const beltDistance = rollAngle * WHEEL_RADIUS;
      cleats.forEach((cleat) => placeCleatAt(cleat, cleat.userData.baseOffset + beltDistance));
    }
    updateBelt(0);

    return { pivot, trackModule, shockRod, spinners, updateBelt };
  }

  const suspensionL = buildSuspensionSide(WHEEL_X);
  const suspensionR = buildSuspensionSide(-WHEEL_X);
  const treadL = suspensionL.spinners;
  const treadR = suspensionR.spinners;

  // --- Torso ----------------------------------------------------------------
  // Everything above the suspension rides one "upperBody" group so it bobs,
  // leans and lifts as a single rig instead of separately-placed parts
  // drifting apart.
  const CHASSIS_TOP = WHEEL_RADIUS * 2;
  const TORSO_Y = CHASSIS_TOP + 0.32;

  const upperBody = new THREE.Group();
  upperBody.position.y = TORSO_Y;
  root.add(upperBody);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 0.85), chassisMat);
  torso.castShadow = true;
  upperBody.add(torso);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.08), trimMat);
  chestPlate.position.set(0, 0.05, 0.445);
  upperBody.add(chestPlate);

  // --- Neck + binocular head --------------------------------------------
  // Short, thicker neck so torso and head read as one connected rig instead
  // of two blocks floating apart; it still sits flush (not merged) with both.
  const NECK_HEIGHT = 0.13;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, NECK_HEIGHT, 8), jointMat);
  neck.position.y = 0.425 + NECK_HEIGHT / 2;
  upperBody.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.y = neck.position.y + NECK_HEIGHT / 2 + 0.14;
  upperBody.add(headGroup);

  const headShell = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.42), chassisMat);
  headShell.castShadow = true;
  headGroup.add(headShell);

  function makeEye() {
    const eye = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.28, 10), chassisMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.14;
    barrel.castShadow = true;
    eye.add(barrel);

    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), visorMat);
    lens.scale.z = 0.5;
    lens.position.z = 0.29;
    eye.add(lens);

    eye.userData.lens = lens;
    return eye;
  }

  const eyeL = makeEye();
  eyeL.position.set(0.16, 0.01, 0.18);
  headGroup.add(eyeL);

  const eyeR = makeEye();
  eyeR.position.set(-0.16, 0.01, 0.18);
  headGroup.add(eyeR);

  // --- Arms ---------------------------------------------------------------
  // Rest tilted forward (not hanging straight down) so the lower arm/claw
  // clears the tread band instead of poking through it.
  const armL = makeArm({ upperLen: 0.44, lowerLen: 0.38, radius: 0.1 }, chassisMat, trimMat, jointMat);
  armL.root.position.set(0.58, 0.26, 0);
  armL.root.rotation.x = ARM_REST_X;
  upperBody.add(armL.root);

  const armR = makeArm({ upperLen: 0.44, lowerLen: 0.38, radius: 0.1 }, chassisMat, trimMat, jointMat);
  armR.root.position.set(-0.58, 0.26, 0);
  armR.root.rotation.x = ARM_REST_X;
  upperBody.add(armR.root);

  return {
    root, upperBody, torso, headGroup, treadL, treadR, restY: TORSO_Y,
    eyeLensL: eyeL.userData.lens, eyeLensR: eyeR.userData.lens,
    eyeL, eyeR,
    armL, armR,
    suspensionL, suspensionR,
  };
}
