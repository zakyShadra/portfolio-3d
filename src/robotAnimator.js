import * as THREE from 'three';

const WALK = { freq: 6, swing: 0.5, elbow: 0.45, bob: 0.035, lean: 0 };
const RUN = { freq: 10, swing: 0.95, elbow: 0.75, bob: 0.07, lean: 0.22 };

export class RobotAnimator {
  constructor(robot) {
    this.robot = robot;
    this.gaitTime = 0;

    this.blinkTimer = 2 + Math.random() * 3;
    this.blinkPhase = 0; // 0 = open

    this.lookTimer = 3 + Math.random() * 4;
    this.lookTargetY = 0;
    this.lookPhase = 0; // 0 idle-still, 1 holding a glance
  }

  update(dt, elapsed, { moving, running }) {
    const r = this.robot;
    const gait = running ? RUN : WALK;

    if (moving) {
      this.gaitTime += dt * gait.freq;
      const w = this.gaitTime;

      r.armL.root.rotation.x = Math.sin(w) * gait.swing;
      r.armR.root.rotation.x = -Math.sin(w) * gait.swing;
      r.legL.root.rotation.x = -Math.sin(w) * (gait.swing * 0.78);
      r.legR.root.rotation.x = Math.sin(w) * (gait.swing * 0.78);

      r.armL.elbow.rotation.x = Math.max(0, Math.sin(w)) * gait.elbow;
      r.armR.elbow.rotation.x = Math.max(0, -Math.sin(w)) * gait.elbow;
      r.legL.elbow.rotation.x = Math.max(0, -Math.sin(w)) * (gait.elbow * 1.3);
      r.legR.elbow.rotation.x = Math.max(0, Math.sin(w)) * (gait.elbow * 1.3);

      r.torso.position.y = 1.59 + Math.abs(Math.sin(w)) * gait.bob;
      r.torso.rotation.x = -gait.lean;
      r.torso.rotation.y = Math.sin(w) * (running ? 0.1 : 0.05);
      r.headGroup.rotation.y = -r.torso.rotation.y * 0.6;
      r.headGroup.rotation.x = gait.lean * 0.5;

      // Movement owns the head while walking/running — park the idle glance.
      this.lookPhase = 0;
      this.lookTimer = 1.5;
    } else {
      const ease = 1 - Math.pow(0.001, dt);
      const joints = [r.armL.root, r.armR.root, r.legL.root, r.legR.root, r.armL.elbow, r.armR.elbow, r.legL.elbow, r.legR.elbow];
      joints.forEach((j) => { j.rotation.x = THREE.MathUtils.lerp(j.rotation.x, 0, ease); });

      r.torso.position.y = THREE.MathUtils.lerp(r.torso.position.y, 1.59, ease);
      r.torso.rotation.x = THREE.MathUtils.lerp(r.torso.rotation.x, 0, ease);
      r.torso.rotation.y = THREE.MathUtils.lerp(r.torso.rotation.y, 0, ease);
      r.torso.scale.y = 1 + Math.sin(elapsed * 1.6) * 0.015; // breathing
      r.headGroup.rotation.x = THREE.MathUtils.lerp(r.headGroup.rotation.x, 0, ease);

      this._idleLook(dt);
    }

    this._blink(dt);
  }

  // Occasional look-around so standing still doesn't read as frozen.
  _idleLook(dt) {
    const r = this.robot;
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      if (this.lookPhase === 0) {
        this.lookTargetY = (Math.random() - 0.5) * 0.7;
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

  // Visor "eyelid": a quick vertical squash rather than a texture swap.
  _blink(dt) {
    const r = this.robot;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase === 0) {
      this.blinkPhase = 1;
      this.blinkTimer = 2.5 + Math.random() * 3.5;
    }
    if (this.blinkPhase === 1) {
      this._blinkProgress = (this._blinkProgress ?? 0) + dt * 14;
      const t = this._blinkProgress;
      const close = t < 1 ? t : Math.max(0, 2 - t);
      r.visor.scale.y = Math.max(0.08, 1 - close);
      if (t >= 2) {
        this.blinkPhase = 0;
        this._blinkProgress = 0;
        r.visor.scale.y = 1;
      }
    }
  }
}
