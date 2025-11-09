import type { ProjectileState } from '../types';
import { PROJECTILE_RADIUS, PROJECTILE_SPEED } from '../utils/constants';

export class Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  radius: number;
  active: boolean;

  constructor(id: string, x: number, y: number, angle: number, ownerId: string) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * PROJECTILE_SPEED;
    this.vy = Math.sin(angle) * PROJECTILE_SPEED;
    this.ownerId = ownerId;
    this.radius = PROJECTILE_RADIUS;
    this.active = true;
  }

  reset(id: string, x: number, y: number, angle: number, ownerId: string): void {
    this.id = id;
    this.x = x;
    this.y = y;
    this.ownerId = ownerId;
    this.active = true;
    
    this.vx = Math.cos(angle) * PROJECTILE_SPEED;
    this.vy = Math.sin(angle) * PROJECTILE_SPEED;
  }

  update(deltaTime: number): void {
    if (!this.active) return;

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }

  isOutOfBounds(width: number, height: number): boolean {
    return (
      this.x < -this.radius ||
      this.x > width + this.radius ||
      this.y < -this.radius ||
      this.y > height + this.radius
    );
  }

  getState(): ProjectileState {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      ownerId: this.ownerId,
      radius: this.radius
    };
  }

  static fromState(state: ProjectileState): Projectile {
    const angle = Math.atan2(state.vy, state.vx);
    const proj = new Projectile(state.id, state.x, state.y, angle, state.ownerId);
    proj.vx = state.vx;
    proj.vy = state.vy;
    return proj;
  }
}