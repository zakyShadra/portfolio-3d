import * as THREE from 'three';

const WALK_ROLL = 4.5;
const RUN_ROLL = 8.5;
const WALK_BOB = 0.025;
const RUN_BOB = 0.05;
const RUN_LEAN = 0.16;

const GESTURES = {
  wave: { raiseX: -2.3, hold: 0.9, wiggleZ: 0.35 },
  both: { raiseX: -1.9, hold: 0.9, both: true },
  point: { raiseX: -1.25, hold: 1.1 },
  shrug: { raiseX: -0.7, hold: 0.8, both: true, pulse: 0.18 },
};
const GESTURE_TYPES = Object.keys(GESTURES);

export class RobotAnimator {
  constructor(robot) {
    this.robot = robot;
    this.rollAngle = 0;

    this.blinkTimer = 2 + Math.random() * 3;
    this.blinkPhase = 0; // 0 = open, 1 = closing/opening
    this._blinkProgress = 0;

    this.lookTimer = 3 + Math.random() * 4;
    this.lookTargetY = 0;
    this.lookPhase = 0; // 0 idle-still, 1 holding a glance

    this.gesture = { phase: 0, t: 0, type: 'wave', side: 'L', nextIn: 1 + Math.random() * 1.5 };
    this.gestureArmX = { L: 0, R: 0 };
    this.gestureArmZ = { L: 0, R: 0 };
  }

  update(dt, elapsed, { moving, running }) {
    const r = this.robot;
    const ease = 1 - Math.pow(0.001, dt);
    const rollSpeed = moving ? (running ? RUN_ROLL : WALK_ROLL) : 0;
    const bobAmount = running ? RUN_BOB : WALK_BOB;

    this.rollAngle += dt * rollSpeed;
    r.treadL.forEach((w) => { w.rotation.y = this.rollAngle; });
    r.treadR.forEach((w) => { w.rotation.y = this.rollAngle; });

    if (moving) {
      r.torso.position.y = 1.06 + Math.abs(Math.sin(this.rollAngle * 2)) * bobAmount;
      r.torso.rotation.x = THREE.MathUtils.lerp(r.torso.rotation.x, -RUN_LEAN * (running ? 1 : 0.25), ease);
      // Treads do the moving — arms just carry a bit of counterbalance sway.
      r.armL.root.rotation.z = Math.sin(this.rollAngle * 0.5) * 0.08;
      r.armR.root.rotation.z = -Math.sin(this.rollAngle * 0.5) * 0.08;
      r.armL.root.rotation.x = THREE.MathUtils.lerp(r.armL.root.rotation.x, 0, ease);
      r.armR.root.rotation.x = THREE.MathUtils.lerp(r.armR.root.rotation.x, 0, ease);

      // Walking cancels any in-progress gesture rather than freezing mid-air.
      this.gesture.phase = 0;
      this.gesture.t = 0;
      this.gestureArmX.L = this.gestureArmX.R = 0;
      this.gestureArmZ.L = this.gestureArmZ.R = 0;

      this.lookPhase = 0;
      this.lookTimer = 1.5;
    } else {
      r.torso.position.y = THREE.MathUtils.lerp(r.torso.position.y, 1.06, ease);
      r.torso.rotation.x = THREE.MathUtils.lerp(r.torso.rotation.x, 0, ease);

      this._idleGesture(dt);
      const swayL = Math.sin(elapsed * 0.6) * 0.04;
      const swayR = -Math.sin(elapsed * 0.6) * 0.04;
      r.armL.root.rotation.z = THREE.MathUtils.lerp(r.armL.root.rotation.z, swayL + this.gestureArmZ.L, ease);
      r.armR.root.rotation.z = THREE.MathUtils.lerp(r.armR.root.rotation.z, swayR + this.gestureArmZ.R, ease);
      r.armL.root.rotation.x = THREE.MathUtils.lerp(r.armL.root.rotation.x, this.gestureArmX.L, ease);
      r.armR.root.rotation.x = THREE.MathUtils.lerp(r.armR.root.rotation.x, this.gestureArmX.R, ease);

      this._idleLook(dt);
    }

    // Curious head tilt — on a little always, more pronounced standing still.
    r.headGroup.rotation.z = Math.sin(elapsed * 0.45) * (moving ? 0.04 : 0.12);

    this._blink(dt);
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
      sides.forEach((s) => { this.gestureArmX[s] = THREE.MathUtils.lerp(0, cfg.raiseX, e); });
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
        this.gestureArmX[s] = THREE.MathUtils.lerp(cfg.raiseX, 0, p);
        this.gestureArmZ[s] = THREE.MathUtils.lerp(this.gestureArmZ[s], 0, p);
      });
      if (p >= 1) {
        g.phase = 0;
        g.nextIn = 1.5 + Math.random() * 2;
        sides.forEach((s) => { this.gestureArmX[s] = 0; this.gestureArmZ[s] = 0; });
      }
    }
  }

  // Occasional look-around so standing still doesn't read as frozen.
  _idleLook(dt) {
    const r = this.robot;
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      if (this.lookPhase === 0) {
        this.lookTargetY = (Math.random() - 0.5) * 0.8;
        this.lookPhase = 1;
        this.lookTimer = 1 + Math.random() * 1.2;
      } else {
        this.lookTargetY = 0;
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
