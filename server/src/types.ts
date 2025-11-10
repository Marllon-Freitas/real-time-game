import { WebSocket } from "ws";

export interface PlayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  timeOfDeath: number;
}

export interface Input {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
}

export interface InputPacket {
  type: 'input';
  seq: number;
  keys: Input;
  timestamp: number;
}

export interface ShootPacket {
  type: 'shoot';
  angle: number;
  timestamp: number;
}

export interface CameraPacket {
  type: 'camera';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraView {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayerConnection {
  ws: WebSocket;
  lastInput: Input;
  lastProcessedSeq: number;
  camera: CameraView;
  visibleCells: Set<string>;
  lastMessageTime: number;
  messageCount: number;
  actionCooldowns: Map<string, number>;
}

export interface EntitySnapshot {
  state: any;
  hash: string;
}

export interface PlayerSnapshot {
  players: Map<string, EntitySnapshot>;
  projectiles: Map<string, EntitySnapshot>;
}