import { WebSocketServer, WebSocket } from 'ws';
import { encode, decode } from '@msgpack/msgpack';
import { v4 as uuidv4 } from 'uuid';

import { GridCellPool, PooledSpatialGrid } from './game/gridPool';
import { circleRectAABBCollision } from './utils/collision';
import { PlayerSnapshotPool } from './game/snapshotPool';
import { ProjectilePool } from './game/projectilePool';

// ==================== INTERFACES ====================
interface PlayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  timeOfDeath: number;
}

interface Input {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
}

interface InputPacket {
  type: 'input';
  seq: number;
  keys: Input;
  timestamp: number;
}

interface ShootPacket {
  type: 'shoot';
  angle: number;
  timestamp: number;
}

interface CameraPacket {
  type: 'camera';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CameraView {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlayerConnection {
  ws: WebSocket;
  lastInput: Input;
  lastProcessedSeq: number;
  lastShootTime: number;
  camera: CameraView;
  visibleCells: Set<string>;
}

// ==================== DELTA MESSAGE POOL ====================
interface EntitySnapshot {
  state: any;
  hash: string;
}

interface PlayerSnapshot {
  players: Map<string, EntitySnapshot>;
  projectiles: Map<string, EntitySnapshot>;
}

class MessagePool {
  private deltaPlayersPool: Record<string, PlayerState>[] = [];
  private deltaProjectilesPool: Record<string, any>[] = [];
  private deletedArrayPool: string[][] = [];

  acquireDeltaPlayers(): Record<string, PlayerState> {
    return this.deltaPlayersPool.pop() || {};
  }

  releaseDeltaPlayers(obj: Record<string, PlayerState>) {
    for (const key in obj) delete obj[key];
    this.deltaPlayersPool.push(obj);
  }

  acquireDeltaProjectiles(): Record<string, any> {
    return this.deltaProjectilesPool.pop() || {};
  }

  releaseDeltaProjectiles(obj: Record<string, any>) {
    for (const key in obj) delete obj[key];
    this.deltaProjectilesPool.push(obj);
  }

  acquireDeletedArray(): string[] {
    const arr = this.deletedArrayPool.pop() || [];
    arr.length = 0;
    return arr;
  }

  releaseDeletedArray(arr: string[]) {
    arr.length = 0;
    this.deletedArrayPool.push(arr);
  }
}

// ==================== GLOBAL GAME STATE ====================
const gameState = new Map<string, PlayerState>();
const connections = new Map<string, PlayerConnection>();

const snapshotPool = new PlayerSnapshotPool(200, 5000, 500);
const projectilePool = new ProjectilePool(100, 10000, 20);
const gridCellPool = new GridCellPool(500);
const messagePool = new MessagePool();

const playerGrid = new PooledSpatialGrid(gridCellPool);
const projectileGrid = new PooledSpatialGrid(gridCellPool);

const playerSnapshots = new Map<string, PlayerSnapshot>();
let currentStateSnapshot: PlayerSnapshot | null = null;
let previousStateSnapshot: PlayerSnapshot | null = null;

const entityCellCache = new Map<string, {
  players: Set<string>,
  projectiles: Set<string>
}>();

// ==================== CONSTANTS ====================
const WORLD_WIDTH = 10000;
const WORLD_HEIGHT = 10000;
const PLAYER_SPEED = 300; // px/s
const TICK_RATE = 30; // TPS
const TICK_INTERVAL = 1000 / TICK_RATE; // ms
const SHOOT_COOLDOWN = 200; // ms

// Spatial Grid
const CELL_SIZE = 200; // px
const CAMERA_PADDING = 100; // px
const DEFAULT_CAMERA_WIDTH = 1920;
const DEFAULT_CAMERA_HEIGHT = 1080;

// Sync
const FULL_STATE_INTERVAL = 60; // ticks (send full state every 2 seconds)
const REAPER_DELAY = 5000; // ms (time dead bodies stay)

// ==================== HELPERS ====================
function hashEntity(entity: any, type: 'player' | 'projectile'): string {
  if (type === 'player') {
    return `${entity.x.toFixed(2)}|${entity.y.toFixed(2)}|${entity.health}|${entity.isDead}`;
  } else {
    return `${entity.x.toFixed(2)}|${entity.y.toFixed(2)}`;
  }
}

function getGridKey(x: number, y: number): string {
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  return `${col}_${row}`;
}

function getNeighborKeys(col: number, row: number): string[] {
  const keys: string[] = [];
  for (let x = col - 1; x <= col + 1; x++) {
    for (let y = row - 1; y <= row + 1; y++) {
      keys.push(`${x}_${y}`);
    }
  }
  return keys;
}

function updateVisibleCells(camera: CameraView): Set<string> {
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

function buildEntityCellCache() {
  entityCellCache.clear();

  gameState.forEach((player, playerId) => {
    const key = getGridKey(player.x, player.y);
    
    if (!entityCellCache.has(key)) {
      entityCellCache.set(key, { players: new Set(), projectiles: new Set() });
    }
    entityCellCache.get(key)!.players.add(playerId);
  });

  projectilePool.forEach((proj, projId) => {
    const key = getGridKey(proj.x, proj.y);
    
    if (!entityCellCache.has(key)) {
      entityCellCache.set(key, { players: new Set(), projectiles: new Set() });
    }
    entityCellCache.get(key)!.projectiles.add(projId);
  });
}

// ==================== WEBSOCKET SERVER ====================
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  const playerId = uuidv4();

  const playerState: PlayerState = {
    x: Math.random() * (WORLD_WIDTH - 50),
    y: Math.random() * (WORLD_HEIGHT - 50),
    width: 30,
    height: 30,
    health: 100,
    maxHealth: 100,
    isDead: false,
    timeOfDeath: 0
  };

  gameState.set(playerId, playerState);
  
  connections.set(playerId, {
    ws: ws,
    lastInput: { w: false, a: false, s: false, d: false },
    lastProcessedSeq: -1,
    lastShootTime: 0,
    camera: {
      x: 0,
      y: 0,
      width: DEFAULT_CAMERA_WIDTH,
      height: DEFAULT_CAMERA_HEIGHT
    },
    visibleCells: new Set()
  });

  playerSnapshots.set(playerId, snapshotPool.acquire());

  const welcomeMessage = { type: 'welcome', id: playerId };
  const binaryWelcomeMessage = encode(welcomeMessage);
  ws.send(binaryWelcomeMessage);

  ws.on('message', (message) => {
    try {
      const data = decode(message as Buffer) as any;

      const connection = connections.get(playerId);
      if (!connection) return;

      if (data.type === 'input') {
        const inputData = data as InputPacket;
        connection.lastInput = inputData.keys;
        connection.lastProcessedSeq = inputData.seq;
      }

      if (data.type === 'shoot') {
        const shootData = data as ShootPacket;
        handleShoot(playerId, shootData.angle);
      }

      if (data.type === 'camera') {
        const cameraData = data as CameraPacket;
        const connection = connections.get(playerId);
        if (connection) {
          connection.camera = {
            x: cameraData.x,
            y: cameraData.y,
            width: cameraData.width,
            height: cameraData.height
          };
          connection.visibleCells = updateVisibleCells(connection.camera);
        }
      }
    } catch (e) {
      console.error('Failed to process message:', e);
    }
  });

  ws.on('close', () => {
    gameState.delete(playerId); 
    connections.delete(playerId);

    const snapshot = playerSnapshots.get(playerId);
    if (snapshot) {
      snapshotPool.release(snapshot);
      playerSnapshots.delete(playerId);
    }
    
    projectilePool.clearByOwner(playerId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket Error:', error);
  });
});

// ==================== SHOOTING LOGIC ====================
function handleShoot(playerId: string, angle: number): void {
  const connection = connections.get(playerId);
  const player = gameState.get(playerId);
  
  if (!connection || !player || player.isDead) return;

  const now = Date.now();
  
  if (now - connection.lastShootTime < SHOOT_COOLDOWN) return;

  if (!projectilePool.canShoot(playerId)) return;

  connection.lastShootTime = now;

  const projId = `${playerId}-${now}`;
  const playerCenterX = player.x + player.width / 2;
  const playerCenterY = player.y + player.height / 2;

  const projectile = projectilePool.acquire(
    projId, 
    playerCenterX, 
    playerCenterY, 
    angle, 
    playerId
  );
  
  if (!projectile) {
    console.warn(`Shot rejected for player ${playerId} (pool full)`);
  }
}

// ==================== MOVEMENT ====================
function applyInput(player: PlayerState, input: Input, deltaTime: number) {
  let dx = 0;
  let dy = 0;

  if (input.w) dy -= 1;
  if (input.s) dy += 1;
  if (input.a) dx -= 1;
  if (input.d) dx += 1;

  if (dx !== 0 && dy !== 0) {
    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length;
    dy /= length;
  }

  player.x += dx * PLAYER_SPEED * deltaTime;
  player.y += dy * PLAYER_SPEED * deltaTime;

  player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x));
  player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.height, player.y));
}

// ==================== MAIN GAME LOOP ====================
let lastTime = Date.now();
let tickCount = 0;

function gameLoop() {
  const loopStartTime = performance.now();
  let lastCheckpoint = loopStartTime;
  const timings = {
    physics: 0,
    projectileUpdate: 0,
    collision: 0,
    reaping: 0,
    snapshotBuild: 0,
    broadcast: 0,
  };

  const now = Date.now();
  const deltaTime = (now - lastTime) / 1000;
  lastTime = now;

  let collisionCheckCount = 0;

  // ==================== 1. PHYSICS ====================
  playerGrid.clear();
  projectileGrid.clear();

  connections.forEach((connection, playerId) => {
    const player = gameState.get(playerId);
    if (!player || player.isDead) return;

    applyInput(player, connection.lastInput, deltaTime);

    const playerKey = getGridKey(player.x, player.y);
    playerGrid.add(playerKey, playerId);
  });
  timings.physics = performance.now() - lastCheckpoint;
  lastCheckpoint = performance.now();

  // ==================== 2. PROJECTILE UPDATE ====================
  const projectilesToDelete = new Set<string>();

  projectilePool.forEach((proj, projId) => {
    proj.update(deltaTime);

    if (proj.isOutOfBounds(WORLD_WIDTH, WORLD_HEIGHT)) {
      projectilesToDelete.add(projId);
      return;
    }

    const projKey = getGridKey(proj.x, proj.y);
    projectileGrid.add(projKey, projId);
  });
  timings.projectileUpdate = performance.now() - lastCheckpoint;
  lastCheckpoint = performance.now();

  // ==================== 3. COLLISION ====================
  for (const [key, projectileIds] of projectileGrid.entries()) {
    const [col, row] = key.split('_').map(Number);
    const neighborKeys = getNeighborKeys(col, row);

    const playersToCheck = new Set<string>();
    for (const neighborKey of neighborKeys) {
      const playersInCell = playerGrid.get(neighborKey);
      if (playersInCell) {
        playersInCell.forEach(playerId => playersToCheck.add(playerId));
      }
    }

    if (playersToCheck.size === 0) continue;

    projectileIds.forEach(projId => {
      if (projectilesToDelete.has(projId)) return;
      
      const proj = projectilePool.get(projId);
      if (!proj) return;

      playersToCheck.forEach(playerId => {
        collisionCheckCount++;
        const player = gameState.get(playerId);

        if (!player || playerId === proj.ownerId || player.isDead) return;

        if (circleRectAABBCollision(
          proj.x, proj.y, proj.radius,
          player.x, player.y, player.width, player.height
        )) {
          player.health -= 20;
          
          if (player.health <= 0 && !player.isDead) {
            player.health = 0;
            player.isDead = true;
            player.timeOfDeath = now;
          }
          projectilesToDelete.add(projId);
        }
      });
    });
  }

  projectilesToDelete.forEach(projId => {
    projectilePool.release(projId);
  });
  timings.collision = performance.now() - lastCheckpoint;
  lastCheckpoint = performance.now();

  // ==================== 4. REAPING ====================
  const playersToReap: string[] = [];
  gameState.forEach((player, playerId) => {
    if (player.isDead && (now - player.timeOfDeath > REAPER_DELAY)) {
      playersToReap.push(playerId);
    }
  });

  playersToReap.forEach(playerId => {
    gameState.delete(playerId);
    
    const conn = connections.get(playerId);
    if (conn) {
      conn.ws.close(); 
    } else {
      playerSnapshots.delete(playerId);
    }
  });
  timings.reaping = performance.now() - lastCheckpoint;
  lastCheckpoint = performance.now();

  // ==================== 5. SNAPSHOT BUILD ====================
  if (previousStateSnapshot) {
    snapshotPool.release(previousStateSnapshot);
  }
  previousStateSnapshot = currentStateSnapshot;
  currentStateSnapshot = snapshotPool.acquire();

  gameState.forEach((p, pid) => {
    const entitySnap = snapshotPool.createEntitySnapshot(p, hashEntity(p, 'player'));
    currentStateSnapshot!.players.set(pid, entitySnap);
  });

  projectilePool.forEach((proj, projId) => {
    const projState = proj.getState();
    const entitySnap = snapshotPool.createEntitySnapshot(projState, hashEntity(projState, 'projectile'));
    currentStateSnapshot!.projectiles.set(projId, entitySnap);
  });

  buildEntityCellCache();

  timings.snapshotBuild = performance.now() - lastCheckpoint;
  lastCheckpoint = performance.now();

  // ==================== 6. BROADCAST ====================
  const isFullStateFrame = tickCount % FULL_STATE_INTERVAL === 0;
  let sentCount = 0;
  let totalEntitiesSent = 0;

  connections.forEach((connection, playerId) => {
    if (connection.ws.readyState !== WebSocket.OPEN) return;

    const playerState = gameState.get(playerId);
    if (!playerState) return;

    const lastSnapshot = playerSnapshots.get(playerId)!;
    const visibleCells = connection.visibleCells;

    const deltaPlayers = messagePool.acquireDeltaPlayers();
    const deltaProjectiles = messagePool.acquireDeltaProjectiles();
    const deletedPlayers = messagePool.acquireDeletedArray();
    const deletedProjectiles = messagePool.acquireDeletedArray();

    visibleCells.forEach(cellKey => {
      const cellEntities = entityCellCache.get(cellKey);
      if (!cellEntities) return;

      cellEntities.players.forEach(pid => {
        if (pid === playerId) return;

        const current = currentStateSnapshot!.players.get(pid);
        if (!current) return;

        const last = lastSnapshot.players.get(pid);
        if (isFullStateFrame || !last || current.hash !== last.hash) {
          deltaPlayers[pid] = current.state;
          totalEntitiesSent++;
        }
      });

      cellEntities.projectiles.forEach(projId => {
        const current = currentStateSnapshot!.projectiles.get(projId);
        if (!current) return;

        const last = lastSnapshot.projectiles.get(projId);
        if (isFullStateFrame || !last || current.hash !== last.hash) {
          deltaProjectiles[projId] = current.state;
          totalEntitiesSent++;
        }
      });
    });

    lastSnapshot.players.forEach((_, pid) => {
      if (pid !== playerId && !currentStateSnapshot!.players.has(pid)) {
        deletedPlayers.push(pid);
      }
    });

    lastSnapshot.projectiles.forEach((_, projId) => {
      if (!currentStateSnapshot!.projectiles.has(projId)) {
        deletedProjectiles.push(projId);
      }
    });

    const deltaMessage = {
      type: 'gameStateDelta',
      tick: tickCount,
      isFullState: isFullStateFrame,
      lastProcessedInput: connection.lastProcessedSeq,
      yourState: playerState,
      delta: {
        players: deltaPlayers,
        projectiles: deltaProjectiles,
        deletedPlayers: deletedPlayers,
        deletedProjectiles: deletedProjectiles
      }
    };

    const binaryMessage = encode(deltaMessage);
    connection.ws.send(binaryMessage);
    sentCount++;

    messagePool.releaseDeltaPlayers(deltaPlayers);
    messagePool.releaseDeltaProjectiles(deltaProjectiles);
    messagePool.releaseDeletedArray(deletedPlayers);
    messagePool.releaseDeletedArray(deletedProjectiles);
  });

  connections.forEach((connection, playerId) => {
    const visibleCells = connection.visibleCells;
    const oldSnapshot = playerSnapshots.get(playerId)!;
    snapshotPool.release(oldSnapshot);

    const visibleSnapshot = snapshotPool.acquire();

    visibleCells.forEach(cellKey => {
      const cellEntities = entityCellCache.get(cellKey);
      if (!cellEntities) return;

      cellEntities.players.forEach(pid => {
        if (pid === playerId) return;
        const snap = currentStateSnapshot!.players.get(pid);
        if (snap) {
          const newSnap = snapshotPool.createEntitySnapshot(snap.state, snap.hash);
          visibleSnapshot.players.set(pid, newSnap);
        }
      });

      cellEntities.projectiles.forEach(projId => {
        const snap = currentStateSnapshot!.projectiles.get(projId);
        if (snap) {
          const newSnap = snapshotPool.createEntitySnapshot(snap.state, snap.hash);
          visibleSnapshot.projectiles.set(projId, newSnap);
        }
      });
    });

    playerSnapshots.set(playerId, visibleSnapshot);
  });

  timings.broadcast = performance.now() - lastCheckpoint;
  const loopTotalTime = performance.now() - loopStartTime;
  tickCount++;
  
  // ==================== PERFORMANCE LOGGING ====================
  if (tickCount % (TICK_RATE * 5) === 0) {
    const projStats = projectilePool.getStats();
    const gridStats = gridCellPool.getStats();
    const snapStats = snapshotPool.getStats();
    const activeProjectiles = projectilePool.getActive().size;
    const bruteForceChecks = activeProjectiles * gameState.size;
    const avgEntitiesPerPlayer = sentCount > 0 ? totalEntitiesSent / sentCount : 0;
    
    console.log(`\n Tick ${tickCount} Performance Report`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Players: ${gameState.size} | Projectiles: ${activeProjectiles}`);
    console.log(`Projectile Pool: ${projStats.poolSize} free | Reuse: ${projStats.reuseRate}`);
    console.log(`Grid Cell Pool: ${gridStats.poolSize} free | Reuse: ${gridStats.reuseRate}`);
    console.log(`Snapshot Pool: ${snapStats.playerSnapshots.poolSize} free | Reuse: ${snapStats.playerSnapshots.reuseRate}`);
    console.log(`Entity Snapshots: ${snapStats.entitySnapshots.poolSize} free | Reuse: ${snapStats.entitySnapshots.reuseRate}`);
    console.log(` Collision Checks: ${collisionCheckCount} (vs ${bruteForceChecks} brute force)`);
    console.log(`Active Grid Cells: ${playerGrid.size + projectileGrid.size}`);
    console.log(`Network: ${sentCount} msgs | Avg ${avgEntitiesPerPlayer.toFixed(1)} entities/player`);
    
    if (projStats.rejectedShots > 0) {
      console.log(`Rejected Shots: ${projStats.rejectedShots} (spam prevention)`);
    }

    console.log(`\n Timing Breakdown (${loopTotalTime.toFixed(2)}ms total):`);
    
    const logTiming = (name: string, time: number) => {
      const perc = loopTotalTime > 0 ? (time / loopTotalTime) * 100 : 0;
      console.log(`  ${name.padEnd(15, ' ')} ${time.toFixed(2).padStart(6, ' ')}ms (${perc.toFixed(1).padStart(5, ' ')}%)`);
    };
    
    logTiming('Physics:', timings.physics);
    logTiming('Projectile:', timings.projectileUpdate);
    logTiming('Collision:', timings.collision);
    logTiming('Reaping:', timings.reaping);
    logTiming('Snapshot Build:', timings.snapshotBuild);
    logTiming('Broadcast:', timings.broadcast);

    const healthMetric = ((loopTotalTime - TICK_INTERVAL) / TICK_INTERVAL) * 100;

    console.log(`\n Tick Health: ${healthMetric.toFixed(1)}% (${loopTotalTime.toFixed(2)}ms / ${TICK_INTERVAL.toFixed(2)}ms)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}
// ==================== INICIAR SERVIDOR ====================

setInterval(gameLoop, TICK_INTERVAL);

console.log(`Server started on ws://localhost:8080 (Tick Rate: ${TICK_RATE} TPS / ${TICK_INTERVAL.toFixed(2)}ms)`);

function spawnBot(id: number) {
  const botWs = new WebSocket('ws://localhost:8080');
  let myId = `bot-${id}`;
  let input = { w: false, a: false, s: false, d: false };

  botWs.on('open', () => {
    setInterval(() => {
      const rand = Math.random();
      input = { w: false, a: false, s: false, d: false };
      if (rand < 0.25) input.w = true;
      else if (rand < 0.5) input.a = true;
      else if (rand < 0.75) input.s = true;
      else input.d = true;
    }, 2000);

    setInterval(() => {
      if (botWs.readyState === WebSocket.OPEN) { 
        botWs.send(encode({
          type: 'shoot',
          angle: Math.random() * 2 * Math.PI,
          timestamp: Date.now()
        }));
      }
    }, 500);

    setInterval(() => {
      if (botWs.readyState === WebSocket.OPEN) {
        botWs.send(encode({
          type: 'input',
          seq: 1,
          keys: input,
          timestamp: Date.now()
        }));
      }
    }, 50);
  });

  botWs.on('message', (message) => {
    try {
      const data = decode(message as Buffer) as any;
      if (data.type === 'welcome') {
        myId = data.id;
      }
    } catch (e) {
    }
  });

  botWs.on('close', () => console.log(`🤖 Bot ${id} desconectado.`));
  
  botWs.on('error', (error) => console.log(`🤖 Bot ${id} erro: ${error.message}`));
}

const NUM_BOTS = 1000;
for (let i = 0; i < NUM_BOTS; i++) {
  spawnBot(i);
}