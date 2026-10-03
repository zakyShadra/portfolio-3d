import * as THREE from 'three';
import { PLANET_RADIUS, PLANET_CENTER, groundRadiusAt, placeOnSphere } from './terrain.js';
import { buildRobot } from './robot.js';
import { RobotAnimator } from './robotAnimator.js';

const WALK_SPEED = 9;
const RUN_SPEED = 16;
const SNEAK_SPEED = 4;
const TURN_RATE = 2.6; // rad/s pivot turn at walk pace; scales with speed below
const JUMP_SPEED = 9;
const GRAVITY = -24;

export class Player {
  constructor(terrainMesh, spawn = new THREE.Vector3(0, 0, 0)) {
    this.terrainMesh = terrainMesh;

    // group = ground position + facing (physics). robot.root hangs off it so
    // gait bob/lean never fights the ground-contact math below.
    this.group = new THREE.Group();
    this.robot = buildRobot();
    this.group.add(this.robot.root);
    this.animator = new RobotAnimator(this.robot);

    // We're standing on a sphere, not a flat plane, so there's no single
    // world "up" — instead we track our own local frame: `up` is the
    // direction from the planet's center through us (surface normal), and
    // `forward` is the tangent direction we're facing. Walking forward
    // rolls this frame along a great circle, which is exactly how you'd
    // walk around a small moon and loop back to your starting point.
    const { dir } = placeOnSphere(terrainMesh, spawn.x, spawn.z);
    this.up = dir.clone();
    this.forward = new THREE.Vector3(0, 0, 1).sub(this.up.clone().multiplyScalar(this.up.z)).normalize();
    if (!Number.isFinite(this.forward.x)) this.forward.set(0, 0, 1);

    this.velocityRadial = 0;
    this.grounded = true;
    this.elapsed = 0;

    this.radialDistance = groundRadiusAt(terrainMesh, this.up);
    this.group.position.copy(PLANET_CENTER).addScaledVector(this.up, this.radialDistance);
    this._applyOrientation();
  }

  _applyOrientation() {
    const right = new THREE.Vector3().crossVectors(this.up, this.forward).normalize();
    const basis = new THREE.Matrix4().makeBasis(right, this.up, this.forward);
    this.group.quaternion.setFromRotationMatrix(basis);
  }

  update(dt, input) {
    this.elapsed += dt;

    // Tank controls: W/S drive forward/back along the robot's own facing;
    // A/D pivot-turn it by spinning the tracks against each other (handled
    // visually in the animator as left/right tread differential), not a
    // camera-relative strafe — so turning no longer depends on camera yaw.
    const forwardInput = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const turnInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const moving = forwardInput !== 0 || turnInput !== 0;
    const sneaking = input.sneak;
    const running = moving && input.run && !sneaking;

    const speed = sneaking ? SNEAK_SPEED : running ? RUN_SPEED : WALK_SPEED;
    const turnRate = TURN_RATE * (speed / WALK_SPEED);

    // Pivot-turn: spin `forward` around our local vertical axis.
    if (turnInput !== 0) {
      const turnQ = new THREE.Quaternion().setFromAxisAngle(this.up, turnInput * turnRate * dt);
      this.forward.applyQuaternion(turnQ).normalize();
    }

    // Walk/run: roll the (up, forward) frame along the great circle they
    // define, around the axis perpendicular to both — this is what moves
    // us across the planet's curved surface instead of a flat plane.
    if (forwardInput !== 0) {
      const rollAxis = new THREE.Vector3().crossVectors(this.up, this.forward).normalize();
      const arcAngle = (forwardInput * speed * dt) / PLANET_RADIUS;
      const rollQ = new THREE.Quaternion().setFromAxisAngle(rollAxis, arcAngle);
      this.up.applyQuaternion(rollQ).normalize();
      this.forward.applyQuaternion(rollQ).normalize();
    }

    // Guard against floating-point drift so up/forward stay exactly perpendicular.
    this.forward.addScaledVector(this.up, -this.forward.dot(this.up)).normalize();

    const groundRadius = groundRadiusAt(this.terrainMesh, this.up);

    const justJumped = this.grounded && input.jump;
    if (justJumped) {
      this.velocityRadial = JUMP_SPEED;
      this.grounded = false;
    }

    this.velocityRadial += GRAVITY * dt;
    this.radialDistance += this.velocityRadial * dt;

    const wasAirborne = !this.grounded;
    let justLanded = false;
    if (this.radialDistance <= groundRadius) {
      this.radialDistance = groundRadius;
      this.velocityRadial = 0;
      justLanded = wasAirborne;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.group.position.copy(PLANET_CENTER).addScaledVector(this.up, this.radialDistance);
    this._applyOrientation();

    this.animator.update(dt, this.elapsed, {
      forwardInput, turnInput, running, sneaking,
      grounded: this.grounded, justJumped, justLanded,
    });
  }
}
