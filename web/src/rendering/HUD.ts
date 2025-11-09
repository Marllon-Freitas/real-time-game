import type { HUDData } from "../types";
import { HUD_MARGIN } from "../utils/constants";

export class HUD {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(data: HUDData): void {
    const x = HUD_MARGIN;
    let y = HUD_MARGIN;
    const lineHeight = 20;

    this.ctx.fillStyle = data.isConnected ? '#22c55e' : '#ef4444';
    this.ctx.fillRect(x, y, 15, 15);
    y += lineHeight;

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '14px monospace';
    
    this.ctx.fillText(`FPS: ${data.fps}`, x + 25, HUD_MARGIN + 12);
    
    y += lineHeight;
    this.ctx.fillText(`Pending: ${data.pending}`, x, y);
    
    y += lineHeight;
    this.ctx.fillText(`Buffer: ${data.buffer}`, x, y);
    
    y += lineHeight;
    this.ctx.fillText(`Target Delay: ${data.interpTargetDelay}ms`, x, y);

    y += lineHeight;
    this.ctx.fillText(`Buffer Delay: ${data.currentDelay}ms`, x, y);

    y += lineHeight;
    this.ctx.fillText(`Reconciliations: ${data.reconciliations}`, x, y);
    
    if (data.playerId) {
      y += lineHeight;
      this.ctx.fillText(`ID: ${data.playerId.substring(0, 8)}`, x, y);
    }

    if (data.isReconciling) {
      y += lineHeight;
      this.ctx.fillStyle = '#fbbf24';
      this.ctx.fillRect(x, y - 10, 10, 10);
      this.ctx.fillStyle = '#fff';
      this.ctx.fillText('RECONCILING', x + 15, y);
    }
  }

  renderDisconnected(width: number, height: number): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, width, height);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Disconnected... Reconnecting...', width / 2, height / 2);
    this.ctx.textAlign = 'left';
  }
}