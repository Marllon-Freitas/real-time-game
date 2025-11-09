import { encode, decode } from '@msgpack/msgpack';
import type { Input, PendingInput, PlayerState, ServerMessage } from '../types';
import { INPUT_SEND_RATE, INPUT_TIMEOUT, MIN_SEND_INTERVAL, SERVER_URL } from '../utils/constants';
import { StateBuffer } from './stateBuffer';

export class NetworkClient {
  private ws: WebSocket | null = null;
  private myPlayerId: string | null = null;
  private clientSequence = 0;
  private pendingInputs: PendingInput[] = [];
  private lastInput: Input = { w: false, a: false, s: false, d: false };
  private lastSendTime = 0;
  private reconciliationCount = 0;
  private lastReconciliationTime = 0;

  private lastCameraUpdateTime = 0;
  private readonly CAMERA_UPDATE_RATE = 100;

  public stateBuffer = new StateBuffer();

  private onPlayerIdCallback?: (id: string) => void;
  private onReconciliationCallback?: (serverState: PlayerState) => void;

  constructor() {
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(SERVER_URL);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {};

    this.ws.onmessage = (event) => {
      try {
        const data = decode(event.data as ArrayBuffer) as ServerMessage;
        this.handleMessage(data);
      } catch (e) {
        console.error('Error processing message:', e);
      }
    };

    this.ws.onclose = () => {
      this.myPlayerId = null;
      this.stateBuffer.clear();
      setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = (error) => {
      console.error('Connection Error:', error);
    };
  }

  private handleMessage(data: any): void {
    if (data.type === 'welcome') {
      this.myPlayerId = data.id;
      if (this.myPlayerId !== null) {
        this.onPlayerIdCallback?.(this.myPlayerId);
      }
    }

    if (data.type === 'gameStateDelta') {
      this.handleGameStateDelta(data);
    }
  }

  private handleGameStateDelta(data: any): void {
    const lastSnapshot = this.stateBuffer.getLatestSnapshot();
    
    const newSnapshot = this.stateBuffer.cloneSnapshot(lastSnapshot);
    
    newSnapshot.timestamp = Date.now();
    
    const delta = data.delta;
    
    if (data.isFullState) {
        newSnapshot.players.clear();
        newSnapshot.projectiles.clear();
    }
    
    for (const pid in delta.players) {
      if (pid === this.myPlayerId) continue; 
      newSnapshot.players.set(pid, delta.players[pid]);
    }
    for (const projId in delta.projectiles) {
      newSnapshot.projectiles.set(projId, delta.projectiles[projId]);
    }
    
    if (!data.isFullState) {
      for (const pid of delta.deletedPlayers) {
        newSnapshot.players.delete(pid);
      }
      for (const projId of delta.deletedProjectiles) {
        newSnapshot.projectiles.delete(projId);
      }
    }

    this.stateBuffer.addSnapshot(newSnapshot);

    if (this.myPlayerId && data.yourState && data.lastProcessedInput !== undefined) {
      this.reconcilePlayer(data.yourState, data.lastProcessedInput);
    }
  }

  private reconcilePlayer(serverState: PlayerState, lastProcessedSeq: number): void {
    if (lastProcessedSeq >= 0) {
      while (this.pendingInputs.length > 0 && this.pendingInputs[0].seq <= lastProcessedSeq) {
        this.pendingInputs.shift();
      }
    }

    this.onReconciliationCallback?.(serverState);

    if (this.pendingInputs.length > 0) {
      this.reconciliationCount++;
      this.lastReconciliationTime = Date.now();
    }
  }

  sendInput(input: Input): void {
    const now = Date.now();
    const inputChanged = 
      input.w !== this.lastInput.w ||
      input.a !== this.lastInput.a ||
      input.s !== this.lastInput.s ||
      input.d !== this.lastInput.d;
    const timeSinceLastSend = now - this.lastSendTime;

    const shouldSend = (
      (inputChanged || timeSinceLastSend >= INPUT_SEND_RATE) &&
      timeSinceLastSend >= MIN_SEND_INTERVAL &&
      this.isConnected()
    );

    if (shouldSend) {
      const pendingInput: PendingInput = {
        seq: this.clientSequence++,
        timestamp: now,
        keys: { ...input }
      };

      this.pendingInputs.push(pendingInput);

      const payload = {
        type: 'input',
        seq: pendingInput.seq,
        keys: pendingInput.keys,
        timestamp: pendingInput.timestamp
      };

      const binaryPayload = encode(payload);
      this.ws?.send(binaryPayload);

      this.lastInput = { ...input };
      this.lastSendTime = now;
    }

    const cutoffTime = now - INPUT_TIMEOUT;
    while (this.pendingInputs.length > 0 && this.pendingInputs[0].timestamp < cutoffTime) {
      this.pendingInputs.shift();
    }
  }

  sendCameraPosition(cameraX: number, cameraY: number, cameraWidth: number, cameraHeight: number): void {
    const now = Date.now();
    
    if (now - this.lastCameraUpdateTime < this.CAMERA_UPDATE_RATE) return;
    
    if (!this.isConnected()) return;

    const payload = {
      type: 'camera',
      x: Math.round(cameraX),
      y: Math.round(cameraY),
      width: Math.round(cameraWidth),
      height: Math.round(cameraHeight)
    };

    const binaryPayload = encode(payload);
    this.ws?.send(binaryPayload);
    
    this.lastCameraUpdateTime = now;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getPlayerId(): string | null {
    return this.myPlayerId;
  }

  getPendingInputs(): PendingInput[] {
    return this.pendingInputs;
  }

  getReconciliationCount(): number {
    return this.reconciliationCount;
  }

  isRecentlyReconciled(): boolean {
    return Date.now() - this.lastReconciliationTime < 500;
  }

  onPlayerId(callback: (id: string) => void): void {
    this.onPlayerIdCallback = callback;
  }

  onReconciliation(callback: (serverState: PlayerState) => void): void {
    this.onReconciliationCallback = callback;
  }

  sendShoot(angle: number): void {
    if (!this.isConnected()) return;

    const payload = {
      type: 'shoot',
      angle: angle,
      timestamp: Date.now()
    };

    const binaryPayload = encode(payload);
    this.ws?.send(binaryPayload);
  }
}