export interface EntitySnapshot {
  state: any;
  hash: string;
}

export interface PlayerSnapshot {
  players: Map<string, EntitySnapshot>;
  projectiles: Map<string, EntitySnapshot>;
}

class EntitySnapshotPool {
  private pool: EntitySnapshot[] = [];
  private active: Set<EntitySnapshot> = new Set();
  private createCount: number = 0;
  private reuseCount: number = 0;

  constructor(initialSize: number = 2000) {
    this.prewarm(initialSize);
  }

  private prewarm(size: number): void {
    for (let i = 0; i < size; i++) {
      this.pool.push({ state: null, hash: '' });
    }
  }

  acquire(state: any, hash: string): EntitySnapshot {
    let snapshot: EntitySnapshot;

    if (this.pool.length > 0) {
      snapshot = this.pool.pop()!;
      snapshot.state = state;
      snapshot.hash = hash;
      this.reuseCount++;
    } else {
      snapshot = { state, hash };
      this.createCount++;
    }

    this.active.add(snapshot);
    return snapshot;
  }

  release(snapshot: EntitySnapshot): void {
    if (!this.active.has(snapshot)) return;
    
    snapshot.state = null;
    snapshot.hash = '';
    this.active.delete(snapshot);
    this.pool.push(snapshot);
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      activeCount: this.active.size,
      totalCreated: this.createCount,
      totalReused: this.reuseCount,
      reuseRate: this.createCount > 0 
        ? ((this.reuseCount / (this.createCount + this.reuseCount)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

class MapPool<K, V> {
  private pool: Map<K, V>[] = [];
  private active: Set<Map<K, V>> = new Set();
  private createCount: number = 0;
  private reuseCount: number = 0;

  constructor(initialSize: number = 500) {
    this.prewarm(initialSize);
  }

  private prewarm(size: number): void {
    for (let i = 0; i < size; i++) {
      this.pool.push(new Map<K, V>());
    }
  }

  acquire(): Map<K, V> {
    let map: Map<K, V>;

    if (this.pool.length > 0) {
      map = this.pool.pop()!;
      map.clear();
      this.reuseCount++;
    } else {
      map = new Map<K, V>();
      this.createCount++;
    }

    this.active.add(map);
    return map;
  }

  release(map: Map<K, V>): void {
    if (!this.active.has(map)) return;
    
    map.clear();
    this.active.delete(map);
    this.pool.push(map);
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      activeCount: this.active.size,
      totalCreated: this.createCount,
      totalReused: this.reuseCount,
      reuseRate: this.createCount > 0 
        ? ((this.reuseCount / (this.createCount + this.reuseCount)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

export class PlayerSnapshotPool {
  private pool: PlayerSnapshot[] = [];
  private active: Set<PlayerSnapshot> = new Set();
  
  private entitySnapshotPool: EntitySnapshotPool;
  private mapPool: MapPool<string, EntitySnapshot>;
  
  private createCount: number = 0;
  private reuseCount: number = 0;

  constructor(
    initialSize: number = 200,
    entityPoolSize: number = 2000,
    mapPoolSize: number = 500
  ) {
    this.entitySnapshotPool = new EntitySnapshotPool(entityPoolSize);
    this.mapPool = new MapPool<string, EntitySnapshot>(mapPoolSize);
    this.prewarm(initialSize);
  }

  private prewarm(size: number): void {
    for (let i = 0; i < size; i++) {
      const snapshot: PlayerSnapshot = {
        players: new Map(),
        projectiles: new Map()
      };
      this.pool.push(snapshot);
    }
  }

  acquire(): PlayerSnapshot {
    let snapshot: PlayerSnapshot;

    if (this.pool.length > 0) {
      snapshot = this.pool.pop()!;
      snapshot.players.clear();
      snapshot.projectiles.clear();
      this.reuseCount++;
    } else {
      snapshot = {
        players: new Map(),
        projectiles: new Map()
      };
      this.createCount++;
    }

    this.active.add(snapshot);
    return snapshot;
  }

  createEntitySnapshot(state: any, hash: string): EntitySnapshot {
    return this.entitySnapshotPool.acquire(state, hash);
  }

  release(snapshot: PlayerSnapshot): void {
    if (!this.active.has(snapshot)) return;

    snapshot.players.forEach(entitySnap => {
      this.entitySnapshotPool.release(entitySnap);
    });

    snapshot.projectiles.forEach(entitySnap => {
      this.entitySnapshotPool.release(entitySnap);
    });

    snapshot.players.clear();
    snapshot.projectiles.clear();
    
    this.active.delete(snapshot);
    this.pool.push(snapshot);
  }

  releaseAndAcquire(oldSnapshot: PlayerSnapshot | null): PlayerSnapshot {
    if (oldSnapshot) {
      this.release(oldSnapshot);
    }
    return this.acquire();
  }

  getStats() {
    const entityStats = this.entitySnapshotPool.getStats();
    const mapStats = this.mapPool.getStats();

    return {
      playerSnapshots: {
        poolSize: this.pool.length,
        activeCount: this.active.size,
        totalCreated: this.createCount,
        totalReused: this.reuseCount,
        reuseRate: this.createCount > 0 
          ? ((this.reuseCount / (this.createCount + this.reuseCount)) * 100).toFixed(1) + '%'
          : '0%'
      },
      entitySnapshots: entityStats,
      maps: mapStats
    };
  }
  
  clear(): void {
    this.active.forEach(snapshot => {
      snapshot.players.clear();
      snapshot.projectiles.clear();
    });
    this.active.clear();
    this.pool = [];
    this.prewarm(200);
  }
}