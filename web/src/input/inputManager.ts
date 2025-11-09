import type { Input } from '../types';

export class InputManager {
  private keys: Input = {
    w: false,
    a: false,
    s: false,
    d: false
  };

  private mouseX = 0;
  private mouseY = 0;
  private mouseDown = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.resetKeys());

    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown(e: KeyboardEvent): void {
    switch (e.key.toLowerCase()) {
      case 'w': this.keys.w = true; break;
      case 'a': this.keys.a = true; break;
      case 's': this.keys.s = true; break;
      case 'd': this.keys.d = true; break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.key.toLowerCase()) {
      case 'w': this.keys.w = false; break;
      case 'a': this.keys.a = false; break;
      case 's': this.keys.s = false; break;
      case 'd': this.keys.d = false; break;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDown = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDown = false;
    }
  }

  private resetKeys(): void {
    this.keys.w = false;
    this.keys.a = false;
    this.keys.s = false;
    this.keys.d = false;
  }

  getInput(): Input {
    return { ...this.keys };
  }

  hasInput(): boolean {
    return this.keys.w || this.keys.a || this.keys.s || this.keys.d;
  }

  getMousePosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  isMouseDown(): boolean {
    return this.mouseDown;
  }

  getMouseAngle(playerScreenX: number, playerScreenY: number): number {
    const dx = this.mouseX - playerScreenX;
    const dy = this.mouseY - playerScreenY;
    return Math.atan2(dy, dx);
  }
}