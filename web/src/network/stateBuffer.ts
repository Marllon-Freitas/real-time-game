import type { StateSnapshot, PlayerState, ProjectileState } from '../types';
import { 
  DELAY_ADJUSTMENT_SPEED, 
  MAX_BUFFER_SIZE, 
  MAX_INTERPOLATION_DELAY, 
  MIN_INTERPOLATION_DELAY, 
  TICK_INTERVAL 
} from '../utils/constants';
import { clamp, lerp } from '../utils/math';

export class StateBuffer {
  private buffer: StateSnapshot[] = [];
  private currentInterpolationDelay: number = TICK_INTERVAL * 3;

  addSnapshot(snapshot: StateSnapshot): void {
    this.buffer.push(snapshot);

    while (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  getSize(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }

  public getLatestSnapshot(): StateSnapshot | null {
    if (this.buffer.length === 0) {
      return null;
    }
    return this.buffer[this.buffer.length - 1];
  }

  public cloneSnapshot(snapshot: StateSnapshot | null): StateSnapshot {
    if (!snapshot) {
      return {
        timestamp: Date.now(),
        players: new Map(),
        projectiles: new Map()
      };
    }
    
    return {
      timestamp: snapshot.timestamp,
      players: new Map(snapshot.players),
      projectiles: new Map(snapshot.projectiles)
    };
  }

  private findBracketingStates(renderTime: number): [StateSnapshot | null, StateSnapshot | null] {
    if (this.buffer.length < 2) {
      return [null, null];
    }

    let before: StateSnapshot | null = null;
    let after: StateSnapshot | null = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      const current = this.buffer[i];
      const next = this.buffer[i + 1];

      if (current.timestamp <= renderTime && next.timestamp >= renderTime) {
        before = current;
        after = next;
        break;
      }
    }

    if (!before && !after && this.buffer.length >= 2) {
      before = this.buffer[this.buffer.length - 2];
      after = this.buffer[this.buffer.length - 1];
    }

    return [before, after];
  }

  private interpolatePlayer(
    before: StateSnapshot,
    after: StateSnapshot,
    playerId: string,
    renderTime: number
  ): PlayerState | null {
    const playerBefore = before.players.get(playerId);
    const playerAfter = after.players.get(playerId);

    if (!playerBefore || !playerAfter) {
      return null;
    }

    const totalTime = after.timestamp - before.timestamp;
    if (totalTime === 0) return playerAfter;

    const t = (renderTime - before.timestamp) / totalTime;
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      x: lerp(playerBefore.x, playerAfter.x, clampedT),
      y: lerp(playerBefore.y, playerAfter.y, clampedT),
      width: playerBefore.width,
      height: playerBefore.height,
      health: playerAfter.health,
      maxHealth: playerAfter.maxHealth,
      isDead: playerAfter.isDead
    };
  }

  private interpolateProjectile(
    before: StateSnapshot,
    after: StateSnapshot,
    projectileId: string,
    renderTime: number
  ): ProjectileState | null {
    const projBefore = before.projectiles.get(projectileId);
    const projAfter = after.projectiles.get(projectileId);

    if (!projBefore || !projAfter) {
      return null;
    }

    const totalTime = after.timestamp - before.timestamp;
    if (totalTime === 0) return projAfter;

    const t = (renderTime - before.timestamp) / totalTime;
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      id: projAfter.id,
      x: lerp(projBefore.x, projAfter.x, clampedT),
      y: lerp(projBefore.y, projAfter.y, clampedT),
      vx: projAfter.vx,
      vy: projAfter.vy,
      ownerId: projAfter.ownerId,
      radius: projAfter.radius
    };
  }

  getInterpolatedPlayers(): { players: Map<string, PlayerState>; interpTargetDelay: number; currentDelay: number } {
    const now = Date.now();
    const renderTime = now - this.currentInterpolationDelay;
    const [before, after] = this.findBracketingStates(renderTime);

    const interpolatedPlayers = new Map<string, PlayerState>();
    let interpTargetDelay = 0;

    if (before && after) {
      const latestSnapshot = this.buffer[this.buffer.length - 1];
      interpTargetDelay = Math.round(now - latestSnapshot.timestamp);

      const allPlayerIds = new Set<string>();
      before.players.forEach((_, id) => allPlayerIds.add(id));
      after.players.forEach((_, id) => allPlayerIds.add(id));

      allPlayerIds.forEach(playerId => {
        const interpolatedPlayer = this.interpolatePlayer(before, after, playerId, renderTime);
        
        if (interpolatedPlayer) {
          interpolatedPlayers.set(playerId, interpolatedPlayer);
        }
      });
      
      const idealDelay = interpTargetDelay + (TICK_INTERVAL * 1.5);

      const delayDifference = idealDelay - this.currentInterpolationDelay;
      
      if (Math.abs(delayDifference) > TICK_INTERVAL * 0.5) {
        if (delayDifference > 0) {
          this.currentInterpolationDelay += DELAY_ADJUSTMENT_SPEED * 2;
        } else {
          this.currentInterpolationDelay -= DELAY_ADJUSTMENT_SPEED * 2;
        }
      } else {
        if (delayDifference > 0) {
          this.currentInterpolationDelay += DELAY_ADJUSTMENT_SPEED;
        } else if (delayDifference < 0) {
          this.currentInterpolationDelay -= DELAY_ADJUSTMENT_SPEED;
        }
      }

    } else if (this.buffer.length > 0) {
      this.currentInterpolationDelay += DELAY_ADJUSTMENT_SPEED * 5.0;

      const lastSnapshot = this.buffer[this.buffer.length - 1];
      interpTargetDelay = Math.round(now - lastSnapshot.timestamp);
      
      lastSnapshot.players.forEach((player, id) => {
        interpolatedPlayers.set(id, player);
      });
    }

    this.currentInterpolationDelay = clamp(
      this.currentInterpolationDelay,
      MIN_INTERPOLATION_DELAY,
      MAX_INTERPOLATION_DELAY
    );

    return {
      players: interpolatedPlayers,
      interpTargetDelay: interpTargetDelay,
      currentDelay: Math.round(this.currentInterpolationDelay)
    };
  }

  getInterpolatedProjectiles(): Map<string, ProjectileState> {
    const now = Date.now();
    const renderTime = now - this.currentInterpolationDelay;
    const [before, after] = this.findBracketingStates(renderTime);

    const interpolatedProjectiles = new Map<string, ProjectileState>();

    if (before && after) {
      const allProjectileIds = new Set<string>();
      before.projectiles.forEach((_, id) => allProjectileIds.add(id));
      after.projectiles.forEach((_, id) => allProjectileIds.add(id));

      allProjectileIds.forEach(projectileId => {
        const interpolatedProj = this.interpolateProjectile(before, after, projectileId, renderTime);
        if (interpolatedProj) {
          interpolatedProjectiles.set(projectileId, interpolatedProj);
        }
      });
    } else if (this.buffer.length > 0) {
      const lastSnapshot = this.buffer[this.buffer.length - 1];
      lastSnapshot.projectiles.forEach((proj, id) => {
        interpolatedProjectiles.set(id, proj);
      });
    }

    return interpolatedProjectiles;
  }
}