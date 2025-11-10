import { NetworkClient } from "../network/networkClient";
import { HUD } from "../rendering/HUD";
import { Renderer } from "../rendering/renderer";
import { 
  PLAYER_SIZE, 
  SHOOT_COOLDOWN, 
  WORLD_HEIGHT, 
  WORLD_WIDTH, 
  TICK_INTERVAL
} from "../utils/constants";
import { Player } from "./player";
import { InputManager } from "../input/inputManager";
import { Projectile } from "./projectile";
import { Camera } from "./camera";
import type { HUDData, PendingInput, PlayerState } from "../types";
import { lerp } from "../utils/math";

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  public player: Player;
  private camera: Camera;
  private inputManager: InputManager;
  private renderer: Renderer;
  private hud: HUD;
  private network: NetworkClient;

  private serverStateBuffer: { state: PlayerState, seq: number }[] = [];

  private lastPlayerState: PlayerState;
  private currentPlayerState: PlayerState;

  private localProjectiles: Projectile[] = [];
  private lastShootTime = 0;
  
  private running = false;
  private lastTime = 0;

  private physicsAccumulator = 0;

  private frameCount = 0;
  private fps = 0;
  private lastFpsTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    if (!this.ctx) {
      throw new Error('2D context not available');
    }

    this.player = new Player(canvas.width / 2, canvas.height / 2, PLAYER_SIZE, 80, 100);
    this.camera = new Camera(canvas.width, canvas.height, WORLD_WIDTH, WORLD_HEIGHT);
    this.inputManager = new InputManager(this.canvas);
    this.renderer = new Renderer(this.ctx);
    this.hud = new HUD(this.ctx);
    this.network = new NetworkClient();

    this.lastPlayerState = this.player.getState();
    this.currentPlayerState = this.player.getState();

    this.network.onReconciliation((serverState: PlayerState, lastProcessedSeq: number) => {
      this.serverStateBuffer.push({ state: serverState, seq: lastProcessedSeq });
    });
  }

  start(): void {
    if (this.running) return;
    
    this.running = true;
    this.lastTime = performance.now();
    this.lastFpsTime = Date.now();
    
    requestAnimationFrame(this.gameLoop);
  }

  stop(): void {
    this.running = false;
  }

  private gameLoop = (currentTime: number): void => {
    if (!this.running) return;

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    const fixedDeltaTime = TICK_INTERVAL / 1000;
    this.physicsAccumulator += deltaTime;

    while (this.physicsAccumulator >= fixedDeltaTime) {
      this.fixedUpdate(fixedDeltaTime);
      this.physicsAccumulator -= fixedDeltaTime;
    }

    const interpolationAlpha = this.physicsAccumulator / fixedDeltaTime;

    const renderState: PlayerState = {
      ...this.currentPlayerState,
      x: lerp(this.lastPlayerState.x, this.currentPlayerState.x, interpolationAlpha),
      y: lerp(this.lastPlayerState.y, this.currentPlayerState.y, interpolationAlpha),
    };

    this.updateFPS();
    this.update(renderState, deltaTime);
    this.render(renderState, currentTime);

    requestAnimationFrame(this.gameLoop);
  };

  private update(renderState: PlayerState, deltaTime: number,): void {
    this.camera.update(renderState, deltaTime);
  }

private fixedUpdate(fixedDeltaTime: number): void {
  let latestServerState: PlayerState | null = null;
  let lastProcessedSeq = -1;

  while (this.serverStateBuffer.length > 0) {
    const { state, seq } = this.serverStateBuffer.shift()!;
    latestServerState = state;
    lastProcessedSeq = seq;
  }

  if (latestServerState) {
    this.player.setState(latestServerState);
    this.network.removeAcknowledgedInputs(lastProcessedSeq);

    const pendingInputs = this.network.getPendingInputs();
    pendingInputs.forEach((input: PendingInput) => {
      if (!this.player.isDead) {
        this.player.applyInput(input.keys, fixedDeltaTime, WORLD_WIDTH, WORLD_HEIGHT);
      }
    });
  }

  this.lastPlayerState = this.player.getState();

  const input = this.inputManager.getInput();
  if (!this.player.isDead) {
    this.player.applyInput(input, fixedDeltaTime, WORLD_WIDTH, WORLD_HEIGHT);
  }

  this.currentPlayerState = this.player.getState();
  
  this.network.sendInput(input);
  this.network.sendCameraPosition(
    this.camera.x,
    this.camera.y,
    this.camera.width,
    this.camera.height
  );

  if (!this.player.isDead && this.inputManager.isMouseDown() && this.canShoot()) {
    this.shoot();
  }

  for (let i = this.localProjectiles.length - 1; i >= 0; i--) {
    const proj = this.localProjectiles[i];
    proj.update(fixedDeltaTime);

    if (proj.isOutOfBounds(WORLD_WIDTH, WORLD_HEIGHT)) {
      this.localProjectiles.splice(i, 1);
    }
  }
}

  private canShoot(): boolean {
    const now = Date.now();
    return now - this.lastShootTime >= SHOOT_COOLDOWN;
  }

  private shoot(): void {
    const now = Date.now();
    this.lastShootTime = now;

    const playerCenterX = this.player.x + this.player.width / 2;
    const playerCenterY = this.player.y + this.player.height / 2;

    const mousePos = this.inputManager.getMousePosition();
    const worldMouseX = this.camera.toWorldX(mousePos.x);
    const worldMouseY = this.camera.toWorldY(mousePos.y);

    const angle = Math.atan2(worldMouseY - playerCenterY, worldMouseX - playerCenterX);

    const projId = `${this.network.getPlayerId()}-${now}`;
    const projectile = new Projectile(
      projId,
      playerCenterX,
      playerCenterY,
      angle,
      this.network.getPlayerId() || 'local'
    );
    this.localProjectiles.push(projectile);

    this.network.sendShoot(angle);
  }

  private render(localPlayerRenderState: PlayerState, currentTime: number): void {
    this.renderer.clear(this.canvas.width, this.canvas.height);
    this.renderer.beginScene(this.camera);

    this.renderer.drawGrid(this.canvas.width, this.canvas.height);

    const { players: interpolatedPlayers, interpTargetDelay, currentDelay } =
    this.network.stateBuffer.getInterpolatedPlayers(currentTime);
    
    interpolatedPlayers.forEach((player, playerId) => {
      if (this.camera.isVisible(player)) {
        this.renderer.drawRemotePlayer(player, playerId);
      }
    });

    const interpolatedProjectiles = this.network.stateBuffer.getInterpolatedProjectiles(currentTime);
    interpolatedProjectiles.forEach(proj => {
      if (this.camera.isVisible({
        x: proj.x - proj.radius,
        y: proj.y - proj.radius,
        width: proj.radius * 2,
        height: proj.radius * 2
      })) {
        this.renderer.drawProjectile(proj.x, proj.y, proj.radius, proj.ownerId, this.network.getPlayerId());
      }
    });

    // this.localProjectiles.forEach(proj => {
    //   if (this.camera.isVisible({
    //     x: proj.x - proj.radius,
    //     y: proj.y - proj.radius,
    //     width: proj.radius * 2,
    //     height: proj.radius * 2
    //   })) {
    //     this.renderer.drawProjectile(proj.x, proj.y, proj.radius, proj.ownerId, this.network.getPlayerId());
    //   }
    // });

    this.renderer.drawLocalPlayer(localPlayerRenderState);
    this.renderer.drawCrosshair(this.inputManager.getMousePosition().x, this.inputManager.getMousePosition().y);
    
    const hudData: HUDData = {
      fps: this.fps,
      pending: this.network.getPendingInputs().length,
      buffer: this.network.stateBuffer.getSize(),
      interpTargetDelay: interpTargetDelay,
      currentDelay: currentDelay,
      reconciliations: this.network.getReconciliationCount(),
      playerId: this.network.getPlayerId(),
      isReconciling: this.network.isRecentlyReconciled(),
      isConnected: this.network.isConnected()
    };

    this.hud.render(hudData);

    if (!this.network.isConnected()) {
      this.hud.renderDisconnected(this.canvas.width, this.canvas.height);
    }
  }

  private updateFPS(): void {
    this.frameCount++;
    const now = Date.now();

    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }
}