import type { Camera } from '../game/camera';
import type { PlayerState } from '../types';
import { GRID_SIZE } from '../utils/constants';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private camera: Camera | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public beginScene(camera: Camera): void {
    this.camera = camera;
  }

  clear(width: number, height: number): void {
    this.ctx.fillStyle = '#111827';
    this.ctx.fillRect(0, 0, width, height);
  }

  drawGrid(width: number, height: number): void {
    if (!this.camera) return;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;

    const startX = Math.floor(this.camera.x / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(this.camera.y / GRID_SIZE) * GRID_SIZE;

    const endX = this.camera.x + this.camera.width;
    const endY = this.camera.y + this.camera.height;

    for (let x = startX; x <= endX; x += GRID_SIZE) {
      const screenX = this.camera.toScreenX(x);
      this.ctx.beginPath();
      this.ctx.moveTo(screenX, 0);
      this.ctx.lineTo(screenX, height);
      this.ctx.stroke();
    }

    for (let y = startY; y <= endY; y += GRID_SIZE) {
      const screenY = this.camera.toScreenY(y);
      this.ctx.beginPath();
      this.ctx.moveTo(0, screenY);
      this.ctx.lineTo(width, screenY);
      this.ctx.stroke();
    }
  }

  drawLocalPlayer(player: PlayerState): void {
    if (!this.camera) return;

    const screenX = this.camera.toScreenX(player.x);
    const screenY = this.camera.toScreenY(player.y);

    if (player.isDead) {
      this.drawDeadPlayer(screenX, screenY, player.width);
      return;
    }
    this.ctx.fillStyle = '#00d9ff';
    this.ctx.fillRect(screenX, screenY, player.width, player.height);

    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(screenX, screenY, player.width, player.height);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px monospace';
    this.ctx.fillText('YOU', screenX + 2, screenY + player.height + 12);

    this.drawHealthBar(screenX, screenY, player.width, player.health, player.maxHealth);
  }

  drawRemotePlayer(player: PlayerState, playerId: string): void {
    if (!this.camera) return;

    const screenX = this.camera.toScreenX(player.x);
    const screenY = this.camera.toScreenY(player.y);

    if (player.isDead) {
      this.drawDeadPlayer(screenX, screenY, player.width);
      return;
    }
    this.ctx.fillStyle = '#ff6b6b';
    this.ctx.fillRect(screenX, screenY, player.width, player.height);

    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(screenX, screenY, player.width, player.height);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(playerId.substring(0, 4), screenX, screenY + player.height + 12);

    this.ctx.fillStyle = '#ff6b6b';

    this.drawHealthBar(screenX, screenY, player.width, player.health, player.maxHealth);
  }

  drawDeadPlayer(x: number, y: number, size: number): void {
    this.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    this.ctx.fillRect(x, y, size, size);
    
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, size, size);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '10px monospace';
    this.ctx.fillText('DEAD', x, y + size + 12);
  }

  drawHealthBar(screenX: number, screenY: number, width: number, health: number, maxHealth: number): void {
    const barWidth = width;
    const barHeight = 4;
    const offsetY = -8;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(screenX, screenY + offsetY, barWidth, barHeight);

    const percentage = health / maxHealth;
    let color = '#00ff00';
    if (percentage < 0.3) color = '#ff0000';
    else if (percentage < 0.6) color = '#ffaa00';

    this.ctx.fillStyle = color;
    this.ctx.fillRect(screenX, screenY + offsetY, barWidth * percentage, barHeight);
  }

  drawProjectile(x: number, y: number, radius: number, ownerId: string, myPlayerId: string | null): void {
    if (!this.camera) return;

    const screenX = this.camera.toScreenX(x);
    const screenY = this.camera.toScreenY(y);

    const isMine = ownerId === myPlayerId;
    this.ctx.fillStyle = isMine ? '#ffff00' : '#ff6b6b';
    
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  drawCrosshair(screenX: number, screenY: number): void {
    const size = 10;
    const gap = 3;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    this.ctx.moveTo(screenX, screenY - gap);
    this.ctx.lineTo(screenX, screenY - gap - size);

    this.ctx.moveTo(screenX, screenY + gap);
    this.ctx.lineTo(screenX, screenY + gap + size);

    this.ctx.moveTo(screenX - gap, screenY);
    this.ctx.lineTo(screenX - gap - size, screenY);

    this.ctx.moveTo(screenX + gap, screenY);
    this.ctx.lineTo(screenX + gap + size, screenY);

    this.ctx.stroke();
  }
}