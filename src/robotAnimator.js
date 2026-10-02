import * as THREE from 'three';

const WALK_ROLL = 4.5;
const RUN_ROLL = 8.5;
const WALK_BOB = 0.025;
const RUN_BOB = 0.05;
const RUN_LEAN = 0.16;

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
  }

  update(dt, elapsed, { moving, running }) {
    const r = this.robot;
    const rollSpeed = moving ? (running ? RUN_ROLL : WALK_ROLL) : 0;
    const bobAmount = running ? RUN_BOB : WALK_BOB;

    this.rollAngle += dt * rollSpeed;
    r.treadL.rotation.x = Math.PI / 2 + this.rollAngle;
    r.treadR.rotation.x = Math.PI / 2 + this.rollAngle;

    if (moving) {
      r.torso.position.y = 1.06 + Math.abs(Math.sin(this.rollAngle * 2)) * bobAmount;
      r.torso.rotation.x = THREE.MathUtils.lerp(r.torso.rotation.x, -RUN_LEAN * (running ? 1 : 0.25), 1 - Math.pow(0.001, dt));
      // Treads do the moving — arms just carry a bit of counterbalance sway.
      r.armL.root.rotation.z = Math.sin(this.rollAngle * 0.5) * 0.08;
      r.armR.root.rotation.z = -Math.sin(this.rollAngle * 0.5) * 0.08;

      this.lookPhase = 0;
      this.lookTimer = 1.5;
    } else {
      const ease = 1 - Math.pow(0.001, dt);
      r.torso.position.y = THREE.MathUtils.lerp(r.torso.position.y, 1.06, ease);
      r.torso.rotation.x = THREE.MathUtils.lerp(r.torso.rotation.x, 0, ease);
      r.armL.root.rotation.z = THREE.MathUtils.lerp(r.armL.root.rotation.z, Math.sin(elapsed * 0.6) * 0.04, ease);
      r.armR.root.rotation.z = THREE.MathUtils.lerp(r.armR.root.rotation.z, -Math.sin(elapsed * 0.6) * 0.04, ease);

      this._idleLook(dt);
    }

    // Curious head tilt — on a little always, more pronounced standing still.
    r.headGroup.rotation.z = Math.sin(elapsed * 0.45) * (moving ? 0.04 : 0.12);

    this._blink(dt);
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
