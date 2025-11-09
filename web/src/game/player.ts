import type { PlayerState, Input } from '../types';
import { PLAYER_SPEED } from '../utils/constants';
import { normalize, clamp } from '../utils/math';

export class Player {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isDead: boolean = false;

  constructor(x: number, y: number, size: number, health: number, maxHealth: number) {
    this.x = x;
    this.y = y;
    this.width = size;
    this.height = size;
    this.health = health;
    this.maxHealth = maxHealth;
    this.isDead = false;
  }

  applyInput(input: Input, deltaTime: number, worldWidth: number, worldHeight: number): void {
    let dx = 0;
    let dy = 0;

    if (input.w) dy -= 1;
    if (input.s) dy += 1;
    if (input.a) dx -= 1;
    if (input.d) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const normalized = normalize(dx, dy);
      dx = normalized.x;
      dy = normalized.y;
    }

    this.x += dx * PLAYER_SPEED * deltaTime;
    this.y += dy * PLAYER_SPEED * deltaTime;

    this.x = clamp(this.x, 0, worldWidth - this.width);
    this.y = clamp(this.y, 0, worldHeight - this.height);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.isDead = true;
    }
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  getState(): PlayerState {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      health: this.health,
      maxHealth: this.maxHealth,
      isDead: this.isDead
    };
  }

  setState(state: PlayerState): void {
    this.x = state.x;
    this.y = state.y;
    this.width = state.width;
    this.height = state.height;
    this.health = state.health;
    this.maxHealth = state.maxHealth;
    this.isDead = state.isDead;
  }
}