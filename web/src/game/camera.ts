export class Camera {
  x: number;
  y: number;
  width: number;
  height: number;
  
  private worldWidth: number; 
  private worldHeight: number;

  constructor(
    viewportWidth: number, 
    viewportHeight: number, 
    worldWidth: number, 
    worldHeight: number
  ) {
    this.width = viewportWidth;
    this.height = viewportHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.x = 0;
    this.y = 0;
  }

  follow(player: { x: number, y: number, width: number, height: number }): void {
    this.x = (player.x + player.width / 2) - (this.width / 2);
    this.y = (player.y + player.height / 2) - (this.height / 2);

    this.x = Math.max(0, Math.min(this.x, this.worldWidth - this.width));
    this.y = Math.max(0, Math.min(this.y, this.worldHeight - this.height));
  }

  toScreenX(worldX: number): number {
    return worldX - this.x;
  }

  toScreenY(worldY: number): number {
    return worldY - this.y;
  }

  toWorldX(screenX: number): number {
    return screenX + this.x;
  }

  toWorldY(screenY: number): number {
    return screenY + this.y;
  }

  isVisible(entity: { x: number, y: number, width: number, height: number }): boolean {
    return (
      entity.x < this.x + this.width &&
      entity.x + entity.width > this.x &&
      entity.y < this.y + this.height &&
      entity.y + entity.height > this.y
    );
  }
}