export const WORLD_WIDTH = 10000;
export const WORLD_HEIGHT = 10000;
export const PLAYER_SPEED = 300; // px/s
export const TICK_RATE = 30; // TPS
export const TICK_INTERVAL = 1000 / TICK_RATE; // ms
export const SHOOT_COOLDOWN = 200; // ms

// Spatial Grid
export const CELL_SIZE = 200; // px
export const CAMERA_PADDING = 100; // px
export const DEFAULT_CAMERA_WIDTH = 1920;
export const DEFAULT_CAMERA_HEIGHT = 1080;

// Sync
export const FULL_STATE_INTERVAL = 60; // ticks (send full state every 2 seconds)
export const REAPER_DELAY = 5000; // ms (time dead bodies stay)

export const SHOOT_COOLDOWN_TOLERANCE = 0.8;
export const MAX_MESSAGES_PER_SECOND = 60;
export const PACKET_MAX_SIZE = 1024;

export const MIN_CAMERA_WIDTH = 640;
export const MAX_CAMERA_WIDTH = 7680;
export const MIN_CAMERA_HEIGHT = 480;
export const MAX_CAMERA_HEIGHT = 4320;