import { CAMERA_PADDING, CELL_SIZE } from "../constants";
import type { CameraView } from "../types";

export function hashEntity(entity: any, type: 'player' | 'projectile'): string {
  if (type === 'player') {
    return `${entity.x.toFixed(2)}|${entity.y.toFixed(2)}|${entity.health}|${entity.isDead}`;
  } else {
    return `${entity.x.toFixed(2)}|${entity.y.toFixed(2)}`;
  }
}

export function getGridKey(x: number, y: number): string {
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  return `${col}_${row}`;
}

export function getNeighborKeys(col: number, row: number): string[] {
  const keys: string[] = [];
  for (let x = col - 1; x <= col + 1; x++) {
    for (let y = row - 1; y <= row + 1; y++) {
      keys.push(`${x}_${y}`);
    }
  }
  return keys;
}

export function updateVisibleCells(camera: CameraView): Set<string> {
  const padding = CAMERA_PADDING;
  const startCol = Math.floor((camera.x - padding) / CELL_SIZE);
  const endCol = Math.ceil((camera.x + camera.width + padding) / CELL_SIZE);
  const startRow = Math.floor((camera.y - padding) / CELL_SIZE);
  const endRow = Math.ceil((camera.y + camera.height + padding) / CELL_SIZE);

  const cells = new Set<string>();
  for (let col = startCol; col <= endCol; col++) {
    for (let row = startRow; row <= endRow; row++) {
      cells.add(`${col}_${row}`);
    }
  }
  return cells;
}