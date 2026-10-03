import * as THREE from 'three';

const WALK_ROLL = 4.5;
const RUN_ROLL = 8.5;
const SNEAK_ROLL = 2.0;
const TURN_ROLL_RATIO = 0.9; // how hard A/D spin the tracks against each other, relative to the current gait's own roll speed
const WALK_BOB = 0.025;
const RUN_BOB = 0.05;
const SNEAK_BOB = 0.012;
const RUN_LEAN = 0.16;
const SNEAK_LEAN = 0.22; // hunched-forward sneaking posture
const WALK_ARM_SWING = 0.22;
const RUN_ARM_SWING = 0.4;
const SNEAK_ARM_SWING = 0.12;

// Arms rest tilted forward instead of hanging straight down — straight-down
// (0) pokes the lower arm/claw through the tread band at this chassis width.
export const ARM_REST_X = -Math.PI / 4;

// Sneak crouch, applied through the same leg mechanism as the jump (additive
// on top of it, so a crouch-jump just sums both): a shallow sustained
// compress + a small extra body lowering.
const SNEAK_LEG_CROUCH = -0.07;
const SNEAK_BODY_LOWER = -0.05;

const GESTURES = {
  wave: { raiseX: -2.3, hold: 0.9, wiggleZ: 0.35 },
  both: { raiseX: -1.9, hold: 0.9, both: true },
  point: { raiseX: -1.25, hold: 1.1 },
  shrug: { raiseX: -0.7, hold: 0.8, both: true, pulse: 0.18 },
};
const GESTURE_TYPES = Object.keys(GESTURES);

// Jump timeline, driven through the leg mechanism (pivot + shock), not a
// bare body translation. Two values are animated per phase:
//  - bodyLift: the torso's extra lift, riding on top of the legs.
//  - legLift: the shock's travel — negative pulls the track UP into the
//    body (compress/crouch), positive pushes it DOWN away from the body
//    (extend/push-off or trailing in the air). The shock housing + rod + a
//    bit of pivot rotation keep the body and track visibly one mechanism
//    at any amount of travel.
// (seconds / world units)
const JUMP_ANTICIPATE_T = 0.09;
const JUMP_ANTICIPATE_BODY = -0.08;
const JUMP_ANTICIPATE_LEG = -0.12;
const JUMP_EXTEND_T = 0.18;
const JUMP_EXTEND_BODY = 0.12;
const JUMP_EXTEND_LEG = 0.34;
const JUMP_HOLD_LEG = 0.16;
const JUMP_LAND_T = 0.24;
const JUMP_LAND_BODY = -0.1;
const JUMP_LAND_LEG = -0.16;
const JUMP_FOLD_PER_LEG = 1.1; // pivot.rotation.z per unit of legLift — the joint actually rotating

function easeOutQuad(x) {
  return 1 - (1 - x) * (1 - x);
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export class RobotAnimator {
  constructor(robot) {
    this.robot = robot;
    this.rollAngleL = 0;
    this.rollAngleR = 0;
    this.strideAngle = 0;

    this.blinkTimer = 2 + Math.random() * 3;
    this.blinkPhase = 0; // 0 = open, 1 = closing/opening
    this._blinkProgress = 0;

    this.lookTimer = 3 + Math.random() * 4;
    this.lookTargetY = 0;
    this.lookTargetX = 0;
    this.lookPhase = 0; // 0 idle-still, 1 holding a glance

    this.gesture = { phase: 0, t: 0, type: 'wave', side: 'L', nextIn: 1 + Math.random() * 1.5 };
    this.gestureArmX = { L: ARM_REST_X, R: ARM_REST_X };
    this.gestureArmZ = { L: 0, R: 0 };

    this.jumpPhase = 'idle'; // idle -> anticipate -> extend -> hold -> land -> idle
    this.jumpTimer = 0;
    this.bodyLift = 0;
    this.legLift = 0;
    this.jumpStartBody = 0;
    this.jumpStartLeg = 0;

    this.crouchAmount = 0; // 0 = upright, 1 = fully sneak-crouched
  }

  update(dt, elapsed, {
    forwardInput = 0, turnInput = 0, running = false, sneaking = false,
    grounded = true, justJumped = false, justLanded = false,
  }) {
    const r = this.robot;
    const ease = 1 - Math.pow(0.001, dt);
    const moving = forwardInput !== 0 || turnInput !== 0;
    const rollMag = sneaking ? SNEAK_ROLL : running ? RUN_ROLL : WALK_ROLL;
    const bobAmount = sneaking ? SNEAK_BOB : running ? RUN_BOB : WALK_BOB;
    const armSwingAmount = sneaking ? SNEAK_ARM_SWING : running ? RUN_ARM_SWING : WALK_ARM_SWING;

    this.crouchAmount = THREE.MathUtils.lerp(this.crouchAmount, sneaking ? 1 : 0, ease);

    // Differential tread drive: A/D (turnInput) spin the two sides against
    // each other on top of whatever forward/back roll is already happening,
    // so a pivot turn reads as the real left/right track mechanism, not a
    // body rotating with frozen wheels.
    const rollSpeedL = forwardInput * rollMag - turnInput * rollMag * TURN_ROLL_RATIO;
    const rollSpeedR = forwardInput * rollMag + turnInput * rollMag * TURN_ROLL_RATIO;
    this.rollAngleL += dt * rollSpeedL;
    this.rollAngleR += dt * rollSpeedR;
    r.treadL.forEach((w) => { w.rotation.y = this.rollAngleL; });
    r.treadR.forEach((w) => { w.rotation.y = this.rollAngleR; });
    r.suspensionL.updateBelt(this.rollAngleL);
    r.suspensionR.updateBelt(this.rollAngleR);

    if (moving) {
      this.strideAngle += dt * (Math.abs(rollSpeedL) + Math.abs(rollSpeedR)) * 0.5;
      r.upperBody.position.y = r.restY + Math.abs(Math.sin(this.strideAngle * 2)) * bobAmount;
      const leanTarget = forwardInput !== 0
        ? -(sneaking ? SNEAK_LEAN : RUN_LEAN * (running ? 1 : 0.25))
        : 0;
      r.upperBody.rotation.x = THREE.MathUtils.lerp(r.upperBody.rotation.x, leanTarget, ease);
      // Treads do the moving, but arms still swing gently fore-aft with the
      // stride, reversing when driving backward vs forward.
      const dirSign = forwardInput < 0 ? 1 : -1;
      const swing = Math.sin(this.strideAngle * 0.5) * armSwingAmount * dirSign;
      r.armL.root.rotation.z = Math.sin(this.strideAngle * 0.5) * 0.08;
      r.armR.root.rotation.z = -Math.sin(this.strideAngle * 0.5) * 0.08;
      r.armL.root.rotation.x = THREE.MathUtils.lerp(r.armL.root.rotation.x, ARM_REST_X + swing, ease);
      r.armR.root.rotation.x = THREE.MathUtils.lerp(r.armR.root.rotation.x, ARM_REST_X - swing, ease);

      // Walking cancels any in-progress gesture rather than freezing mid-air.
      this.gesture.phase = 0;
      this.gesture.t = 0;
      this.gestureArmX.L = this.gestureArmX.R = ARM_REST_X;
      this.gestureArmZ.L = this.gestureArmZ.R = 0;

      this.lookPhase = 0;
      this.lookTimer = 1.5;
    } else {
      r.upperBody.position.y = THREE.MathUtils.lerp(r.upperBody.position.y, r.restY, ease);
      r.upperBody.rotation.x = THREE.MathUtils.lerp(r.upperBody.rotation.x, 0, ease);

      this._idleGesture(dt);
      const swayL = Math.sin(elapsed * 0.6) * 0.04;
      const swayR = -Math.sin(elapsed * 0.6) * 0.04;
      r.armL.root.rotation.z = THREE.MathUtils.lerp(r.armL.root.rotation.z, swayL + this.gestureArmZ.L, ease);
      r.armR.root.rotation.z = THREE.MathUtils.lerp(r.armR.root.rotation.z, swayR + this.gestureArmZ.R, ease);
      r.armL.root.rotation.x = THREE.MathUtils.lerp(r.armL.root.rotation.x, this.gestureArmX.L, ease);
      r.armR.root.rotation.x = THREE.MathUtils.lerp(r.armR.root.rotation.x, this.gestureArmX.R, ease);

      this._idleLook(dt);
    }

    // Sneak hunch rides on top of whatever lean the gait above already set.
    r.upperBody.rotation.x -= this.crouchAmount * 0.12;

    this._updateJump(dt, { grounded, justJumped, justLanded });
    r.upperBody.position.y += this.bodyLift + this.crouchAmount * SNEAK_BODY_LOWER;
    const crouchLeg = this.crouchAmount * SNEAK_LEG_CROUCH;
    this._applyLeg(r.suspensionL, this.legLift + crouchLeg, 1);
    this._applyLeg(r.suspensionR, this.legLift + crouchLeg, -1);

    // Curious head tilt — on a little always, more pronounced standing still.
    r.headGroup.rotation.z = Math.sin(elapsed * 0.45) * (moving ? 0.04 : 0.12);

    // Binocular eyes pivot up when the legs are extended for a jump, on top
    // of whatever idle vertical glance they're already holding.
    const jumpLookUp = -0.9 * THREE.MathUtils.clamp(this.legLift / JUMP_EXTEND_LEG, 0, 1);
    const eyeTiltX = this.lookTargetX + jumpLookUp;
    r.eyeL.rotation.x = THREE.MathUtils.lerp(r.eyeL.rotation.x, eyeTiltX, ease);
    r.eyeR.rotation.x = THREE.MathUtils.lerp(r.eyeR.rotation.x, eyeTiltX, ease);

    this._blink(dt);
  }

  // Drives one side's suspension chain from a single legLift value: the
  // track module slides along the shock (the prismatic joint), the pivot
  // rotates a matching amount (the actual rotating joint), and the piston
  // rod mesh is rescaled/repositioned to keep visibly bridging the housing
  // to the track — so the leg always reads as one connected mechanism.
  _applyLeg(suspension, legLift, foldSign) {
    suspension.trackModule.position.y = legLift;
    suspension.pivot.rotation.z = foldSign * legLift * JUMP_FOLD_PER_LEG;

    const rodLen = Math.abs(legLift);
    suspension.shockRod.scale.y = Math.max(0.001, rodLen);
    suspension.shockRod.position.y = legLift / 2;
  }

  // Jump timeline driven through the leg mechanism: the suspension
  // compresses (anticipation crouch), then extends hard (the mechanical
  // push-off), trails slightly while airborne, then compresses again on
  // landing to absorb the impact before recovering to neutral.
  _updateJump(dt, { grounded, justJumped, justLanded }) {
    if (justJumped) {
      // Capture wherever the rig actually is right now — if the jump key is
      // re-pressed before the previous landing's recoil has settled back to
      // 0 (bunny-hopping while moving holds Space continuously), anticipate
      // must ease FROM that in-progress value, not snap from a hardcoded 0.
      this.jumpStartBody = this.bodyLift;
      this.jumpStartLeg = this.legLift;
      this.jumpPhase = 'anticipate';
      this.jumpTimer = 0;
    } else if (justLanded) {
      this.jumpPhase = 'land';
      this.jumpTimer = 0;
    }

    this.jumpTimer += dt;

    switch (this.jumpPhase) {
      case 'anticipate': {
        const p = Math.min(1, this.jumpTimer / JUMP_ANTICIPATE_T);
        const e = easeOutQuad(p);
        this.bodyLift = THREE.MathUtils.lerp(this.jumpStartBody, JUMP_ANTICIPATE_BODY, e);
        this.legLift = THREE.MathUtils.lerp(this.jumpStartLeg, JUMP_ANTICIPATE_LEG, e);
        if (p >= 1) { this.jumpPhase = 'extend'; this.jumpTimer = 0; }
        break;
      }
      case 'extend': {
        const p = Math.min(1, this.jumpTimer / JUMP_EXTEND_T);
        const e = easeOutBack(p);
        this.bodyLift = THREE.MathUtils.lerp(JUMP_ANTICIPATE_BODY, JUMP_EXTEND_BODY, e);
        this.legLift = THREE.MathUtils.lerp(JUMP_ANTICIPATE_LEG, JUMP_EXTEND_LEG, e);
        if (p >= 1) { this.jumpPhase = grounded ? 'land' : 'hold'; this.jumpTimer = 0; }
        break;
      }
      case 'hold': {
        const ease = 1 - Math.pow(0.001, dt);
        this.bodyLift = THREE.MathUtils.lerp(this.bodyLift, 0, ease);
        this.legLift = THREE.MathUtils.lerp(this.legLift, JUMP_HOLD_LEG, ease);
        if (grounded) { this.jumpPhase = 'land'; this.jumpTimer = 0; }
        break;
      }
      case 'land': {
        const p = Math.min(1, this.jumpTimer / JUMP_LAND_T);
        if (p < 0.3) {
          const e = p / 0.3;
          this.bodyLift = THREE.MathUtils.lerp(this.bodyLift, JUMP_LAND_BODY, e);
          this.legLift = THREE.MathUtils.lerp(this.legLift, JUMP_LAND_LEG, e);
        } else {
          const e = easeOutQuad((p - 0.3) / 0.7);
          this.bodyLift = THREE.MathUtils.lerp(JUMP_LAND_BODY, 0, e);
          this.legLift = THREE.MathUtils.lerp(JUMP_LAND_LEG, 0, e);
        }
        if (p >= 1) { this.jumpPhase = 'idle'; this.bodyLift = 0; this.legLift = 0; }
        break;
      }
      default: {
        const ease = 1 - Math.pow(0.001, dt);
        this.bodyLift = THREE.MathUtils.lerp(this.bodyLift, 0, ease);
        this.legLift = THREE.MathUtils.lerp(this.legLift, 0, ease);
      }
    }
  }

  // A free-form idle gesture (raise-and-wave one arm, or lift both) so
  // standing still doesn't look purely robotic-frozen.
  _idleGesture(dt) {
    const g = this.gesture;

    if (g.phase === 0) {
      g.nextIn -= dt;
      if (g.nextIn <= 0) {
        g.type = GESTURE_TYPES[Math.floor(Math.random() * GESTURE_TYPES.length)];
        g.side = Math.random() < 0.5 ? 'L' : 'R';
        g.phase = 1;
        g.t = 0;
      }
      return;
    }

    g.t += dt;
    const cfg = GESTURES[g.type];
    const sides = cfg.both ? ['L', 'R'] : [g.side];

    if (g.phase === 1) { // raise
      const p = Math.min(1, g.t / 0.35);
      const e = 1 - (1 - p) * (1 - p);
      sides.forEach((s) => { this.gestureArmX[s] = THREE.MathUtils.lerp(ARM_REST_X, cfg.raiseX, e); });
      if (p >= 1) { g.phase = 2; g.t = 0; }
    } else if (g.phase === 2) { // hold / wave / pulse
      sides.forEach((s) => {
        if (cfg.wiggleZ) {
          this.gestureArmX[s] = cfg.raiseX;
          this.gestureArmZ[s] = Math.sin(g.t * 11) * cfg.wiggleZ * (s === 'L' ? 1 : -1);
        } else if (cfg.pulse) {
          this.gestureArmX[s] = cfg.raiseX + Math.sin(g.t * 16) * cfg.pulse;
        } else {
          this.gestureArmX[s] = cfg.raiseX;
        }
      });
      if (g.t >= cfg.hold) { g.phase = 3; g.t = 0; }
    } else if (g.phase === 3) { // lower
      const p = Math.min(1, g.t / 0.35);
      sides.forEach((s) => {
        this.gestureArmX[s] = THREE.MathUtils.lerp(cfg.raiseX, ARM_REST_X, p);
        this.gestureArmZ[s] = THREE.MathUtils.lerp(this.gestureArmZ[s], 0, p);
      });
      if (p >= 1) {
        g.phase = 0;
        g.nextIn = 1.5 + Math.random() * 2;
        sides.forEach((s) => { this.gestureArmX[s] = ARM_REST_X; this.gestureArmZ[s] = 0; });
      }
    }
  }

  // Occasional look-around so standing still doesn't read as frozen — the
  // head swivels left/right while the binocular eyes pivot up/down on
  // their own, like the reference sketch's independently-aimed vision units.
  _idleLook(dt) {
    const r = this.robot;
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      if (this.lookPhase === 0) {
        this.lookTargetY = (Math.random() - 0.5) * 0.8;
        this.lookTargetX = (Math.random() - 0.5) * 0.5;
        this.lookPhase = 1;
        this.lookTimer = 1 + Math.random() * 1.2;
      } else {
        this.lookTargetY = 0;
        this.lookTargetX = 0;
        this.lookPhase = 0;
        this.lookTimer = 3 + Math.random() * 4;
      }
    }
    r.headGroup.rotation.y = THREE.MathUtils.lerp(r.headGroup.rotation.y, this.lookTargetY, 1 - Math.pow(0.001, dt));
  }

  // Binocular lenses squash shut briefly, like an eyelid.
  _blink(dt) {
    const r = this.robot;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase === 0) {
      this.blinkPhase = 1;
      this.blinkTimer = 2.5 + Math.random() * 3.5;
    }
    if (this.blinkPhase === 1) {
      this._blinkProgress += dt * 14;
      const t = this._blinkProgress;
      const close = t < 1 ? t : Math.max(0, 2 - t);
      const scale = Math.max(0.1, 1 - close);
      r.eyeLensL.scale.y = scale;
      r.eyeLensR.scale.y = scale;
      if (t >= 2) {
        this.blinkPhase = 0;
        this._blinkProgress = 0;
        r.eyeLensL.scale.y = 1;
        r.eyeLensR.scale.y = 1;
      }
    }
  }
}
