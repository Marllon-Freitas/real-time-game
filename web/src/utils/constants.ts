// === Gameplay ===
// (Units in pixels or pixels per second)
export const PLAYER_SPEED = 300;
export const PLAYER_SIZE = 30;

export const PROJECTILE_SPEED = 600;
export const PROJECTILE_RADIUS = 4;
export const SHOOT_COOLDOWN = 200;

export const WORLD_WIDTH = 10000;
export const WORLD_HEIGHT = 10000;

export const GRID_SIZE = 50;
export const HUD_MARGIN = 10;

export const CAMERA_FOLLOW_SPEED = 15.0;

// === Network ===
// (Units in milliseconds)
export const SERVER_URL = 'ws://localhost:8080';
export const MIN_SEND_INTERVAL = 30;
export const INPUT_SEND_RATE = 50;

export const TICK_RATE = 30;
export const TICK_INTERVAL = 1000 / TICK_RATE;

// === Interpolation ===
export const MIN_INTERPOLATION_DELAY = TICK_INTERVAL * 1.5;
export const MAX_INTERPOLATION_DELAY = 1000;
export const DELAY_ADJUSTMENT_SPEED = 10.0;
export const MAX_BUFFER_SIZE = 20;

// === Reconciliation ===
export const INPUT_TIMEOUT = 2000;