import { Projectile } from './projectile';

class ProjectilePool {
  private pool: Projectile[] = [];
  private active: Map<string, Projectile> = new Map();
  
  private projectilesByOwner: Map<string, Set<string>> = new Map();
  
  private initialSize: number;
  private maxSize: number;
  private maxPerPlayer: number;
  private createCount: number = 0;
  private reuseCount: number = 0;
  private rejectedShots: number = 0;

  constructor(
    initialSize: number = 200, 
    maxSize: number = 5000,
    maxPerPlayer: number = 20
  ) {
    this.initialSize = initialSize;
    this.maxSize = maxSize;
    this.maxPerPlayer = maxPerPlayer;
    this.prewarm();
  }

  private prewarm(): void {
    for (let i = 0; i < this.initialSize; i++) {
      const proj = new Projectile('', 0, 0, 0, '');
      proj.active = false;
      this.pool.push(proj);
    }
  }

  canShoot(ownerId: string): boolean {
    const playerProjectiles = this.projectilesByOwner.get(ownerId);
    const count = playerProjectiles ? playerProjectiles.size : 0;
    return count < this.maxPerPlayer;
  }

  acquire(id: string, x: number, y: number, angle: number, ownerId: string): Projectile | null {
    if (!this.canShoot(ownerId)) {
      this.rejectedShots++;
      return null;
    }

    let projectile: Projectile;

    if (this.pool.length > 0) {
      projectile = this.pool.pop()!;
      this.reuseCount++;
    } else {
      if (this.active.size >= this.maxSize) {
        this.rejectedShots++;
        return null;
      }
      projectile = new Projectile(id, x, y, angle, ownerId);
      this.createCount++;
    }

    projectile.reset(id, x, y, angle, ownerId);
    projectile.active = true;
    
    this.active.set(id, projectile);
    
    if (!this.projectilesByOwner.has(ownerId)) {
      this.projectilesByOwner.set(ownerId, new Set());
    }

    this.projectilesByOwner.get(ownerId)!.add(id);
    
    return projectile;
  }

  release(id: string): boolean {
    const projectile = this.active.get(id);
    if (!projectile) return false;

    const ownerId = projectile.ownerId;

    projectile.active = false;
    this.active.delete(id);

    const playerProjs = this.projectilesByOwner.get(ownerId);
    if (playerProjs) {
      playerProjs.delete(id);
      if (playerProjs.size === 0) {
        this.projectilesByOwner.delete(ownerId);
      }
    }

    if (this.pool.length < this.maxSize) {
      this.pool.push(projectile);
    }

    return true;
  }

  getPlayerProjectileCount(ownerId: string): number {
    const playerProjs = this.projectilesByOwner.get(ownerId);
    return playerProjs ? playerProjs.size : 0;
  }

  get(id: string): Projectile | undefined {
    return this.active.get(id);
  }

  getActive(): Map<string, Projectile> {
    return this.active;
  }

  forEach(callback: (projectile: Projectile, id: string) => void): void {
    this.active.forEach(callback);
  }

  clearByOwner(ownerId: string): void {
    const playerProjs = this.projectilesByOwner.get(ownerId);
    if (!playerProjs) return;

    const toRelease = Array.from(playerProjs);
    toRelease.forEach(id => this.release(id));
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      activeCount: this.active.size,
      totalCreated: this.createCount,
      totalReused: this.reuseCount,
      rejectedShots: this.rejectedShots,
      reuseRate: this.createCount > 0 
        ? ((this.reuseCount / (this.createCount + this.reuseCount)) * 100).toFixed(1) + '%'
        : '0%',
      activePlayers: this.projectilesByOwner.size
    };
  }

  clear(): void {
    this.active.clear();
    this.projectilesByOwner.clear();
    this.pool = [];
    this.prewarm();
  }
}

export { ProjectilePool };