import { PlayerState } from "../types";

export class MessagePool {
  private deltaPlayersPool: Record<string, PlayerState>[] = [];
  private deltaProjectilesPool: Record<string, any>[] = [];
  private deletedArrayPool: string[][] = [];

  acquireDeltaPlayers(): Record<string, PlayerState> {
    return this.deltaPlayersPool.pop() || {};
  }

  releaseDeltaPlayers(obj: Record<string, PlayerState>) {
    for (const key in obj) delete obj[key];
    this.deltaPlayersPool.push(obj);
  }

  acquireDeltaProjectiles(): Record<string, any> {
    return this.deltaProjectilesPool.pop() || {};
  }

  releaseDeltaProjectiles(obj: Record<string, any>) {
    for (const key in obj) delete obj[key];
    this.deltaProjectilesPool.push(obj);
  }

  acquireDeletedArray(): string[] {
    const arr = this.deletedArrayPool.pop() || [];
    arr.length = 0;
    return arr;
  }

  releaseDeletedArray(arr: string[]) {
    arr.length = 0;
    this.deletedArrayPool.push(arr);
  }
}