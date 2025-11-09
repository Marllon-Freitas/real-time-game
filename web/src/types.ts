export interface PlayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  radius: number;
}

export interface Input {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
}

export interface PendingInput {
  seq: number;
  timestamp: number;
  keys: Input;
}

export interface StateSnapshot {
  timestamp: number;
  players: Map<string, PlayerState>;
  projectiles: Map<string, ProjectileState>;
}

export interface ShootMessage {
  type: 'shoot';
  angle: number;
  timestamp: number;
}

export interface GameStateMessage {
  type: 'gameState';
  state: Record<string, PlayerState>;
  yourState?: PlayerState;
  lastProcessedInput?: number;
  tick: number;
  projectiles?: Record<string, ProjectileState>;
}

export interface WelcomeMessage {
  type: 'welcome';
  id: string;
}

export interface InputMessage {
  type: 'input';
  seq: number;
  keys: Input;
  timestamp: number;
}

export interface HUDData {
  fps: number;
  pending: number;
  buffer: number;
  interpTargetDelay: number;
  currentDelay: number;
  reconciliations: number;
  playerId: string | null;
  isReconciling: boolean;
  isConnected: boolean;
}

export type ServerMessage = GameStateMessage | WelcomeMessage;