export class GridCellPool {
  private pool: Set<string>[] = [];
  private active: Set<Set<string>> = new Set();
  private createCount: number = 0;
  private reuseCount: number = 0;

  constructor(initialSize: number = 500) {
    this.prewarm(initialSize);
  }

  private prewarm(size: number): void {
    for (let i = 0; i < size; i++) {
      this.pool.push(new Set<string>());
    }
  }

  acquire(): Set<string> {
    let cell: Set<string>;

    if (this.pool.length > 0) {
      cell = this.pool.pop()!;
      cell.clear();
      this.reuseCount++;
    } else {
      cell = new Set<string>();
      this.createCount++;
    }

    this.active.add(cell);
    return cell;
  }

  release(cell: Set<string>): void {
    if (!this.active.has(cell)) return;

    cell.clear();
    this.active.delete(cell);
    this.pool.push(cell);
  }

  releaseAll(grid: Map<string, Set<string>>): void {
    grid.forEach(cell => {
      this.release(cell);
    });
    grid.clear();
  }

  getStats() {
    const totalAcquisitions = this.createCount + this.reuseCount;
    const reuseRate = totalAcquisitions > 0 
      ? (this.reuseCount / totalAcquisitions) * 100
      : 0;

    return {
      poolSize: this.pool.length,
      activeCount: this.active.size,
      totalCreated: this.createCount,
      totalReused: this.reuseCount,
      reuseRate: reuseRate.toFixed(1) + '%'
    };
  }

  clear(): void {
    this.pool = [];
    this.active.clear();
    this.prewarm(500);
  }
}

export class PooledSpatialGrid {
  private grid: Map<string, Set<string>> = new Map();
  private cellPool: GridCellPool;

  constructor(cellPool: GridCellPool) {
    this.cellPool = cellPool;
  }

  add(key: string, id: string): void {
    let cell = this.grid.get(key);
    
    if (!cell) {
      cell = this.cellPool.acquire();
      this.grid.set(key, cell);
    }
    
    cell.add(id);
  }

  get(key: string): Set<string> | undefined {
    return this.grid.get(key);
  }

  has(key: string): boolean {
    return this.grid.has(key);
  }

  entries(): IterableIterator<[string, Set<string>]> {
    return this.grid.entries();
  }

  forEach(callback: (value: Set<string>, key: string) => void): void {
    this.grid.forEach(callback);
  }

  get size(): number {
    return this.grid.size;
  }

  clear(): void {
    this.cellPool.releaseAll(this.grid);
  }

  delete(key: string): boolean {
    const cell = this.grid.get(key);
    if (!cell) return false;
    
    this.cellPool.release(cell);
    return this.grid.delete(key);
  }
}