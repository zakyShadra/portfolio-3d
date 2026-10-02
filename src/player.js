import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { buildRobot } from './robot.js';
import { RobotAnimator } from './robotAnimator.js';

const WALK_SPEED = 9;
const RUN_SPEED = 16;
const JUMP_SPEED = 9;
const GRAVITY = -24;
const TURN_SMOOTH = 10;

export class Player {
  constructor(noise2D, spawn = new THREE.Vector3(0, 0, 0)) {
    this.noise2D = noise2D;

    // group = ground position + facing (physics). robot.root hangs off it so
    // gait bob/lean never fights the ground-contact math below.
    this.group = new THREE.Group();
    this.robot = buildRobot();
    this.group.add(this.robot.root);
    this.animator = new RobotAnimator(this.robot);

    this.velocityY = 0;
    this.grounded = true;
    this.facing = 0; // yaw in radians
    this.elapsed = 0;

    const y = heightAt(noise2D, spawn.x, spawn.z);
    this.group.position.set(spawn.x, y, spawn.z);
  }

  update(dt, input, cameraYaw) {
    this.elapsed += dt;

    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveZ = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
    const moving = moveX !== 0 || moveZ !== 0;
    const running = moving && input.run;
    const speed = running ? RUN_SPEED : WALK_SPEED;

    if (moving) {
      const moveAngle = Math.atan2(moveX, moveZ) + cameraYaw;
      let diff = moveAngle - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, TURN_SMOOTH * dt);

      this.group.position.x += Math.sin(moveAngle) * speed * dt;
      this.group.position.z += Math.cos(moveAngle) * speed * dt;
      this.group.rotation.y = this.facing;
    }

    this.animator.update(dt, this.elapsed, { moving, running, moveZ });

    const groundY = heightAt(this.noise2D, this.group.position.x, this.group.position.z);

    if (this.grounded && input.jump) {
      this.velocityY = JUMP_SPEED;
      this.grounded = false;
    }

    this.velocityY += GRAVITY * dt;
    this.group.position.y += this.velocityY * dt;

    if (this.group.position.y <= groundY) {
      this.group.position.y = groundY;
      this.velocityY = 0;
      this.grounded = true;
    }
  }
}
