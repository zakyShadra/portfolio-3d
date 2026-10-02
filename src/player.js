import * as THREE from 'three';
import { heightAt } from './terrain.js';

const WALK_SPEED = 9;
const RUN_SPEED = 16;
const JUMP_SPEED = 9;
const GRAVITY = -24;
const TURN_SMOOTH = 10;

export class Player {
  constructor(noise2D, spawn = new THREE.Vector3(0, 0, 0)) {
    this.noise2D = noise2D;
    this.group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1.0, 4, 10),
      new THREE.MeshStandardMaterial({ color: '#ff5c2e', roughness: 0.6 }),
    );
    body.position.y = 1.1;
    body.castShadow = true;
    this.group.add(body);
    this.body = body;

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.18, 0.1),
      new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.3 }),
    );
    visor.position.set(0, 1.55, 0.42);
    this.group.add(visor);

    this.velocityY = 0;
    this.grounded = true;
    this.facing = 0; // yaw in radians
    this.bobTime = 0;

    const y = heightAt(noise2D, spawn.x, spawn.z);
    this.group.position.set(spawn.x, y, spawn.z);
  }

  update(dt, input, cameraYaw) {
    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveZ = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
    const moving = moveX !== 0 || moveZ !== 0;
    const speed = input.run ? RUN_SPEED : WALK_SPEED;

    if (moving) {
      // Movement is relative to where the camera is looking.
      const moveAngle = Math.atan2(moveX, moveZ) + cameraYaw;
      const targetFacing = moveAngle;
      let diff = targetFacing - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, TURN_SMOOTH * dt);

      const dx = Math.sin(moveAngle) * speed * dt;
      const dz = Math.cos(moveAngle) * speed * dt;
      this.group.position.x += dx;
      this.group.position.z += dz;
      this.group.rotation.y = this.facing;

      this.bobTime += dt * (input.run ? 14 : 9);
      this.body.position.y = 1.1 + Math.abs(Math.sin(this.bobTime)) * 0.06;
    } else {
      this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, 1.1, dt * 6);
    }

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
