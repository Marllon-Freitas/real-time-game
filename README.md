# Multiplayer PvP Web Game

> A high-performance multiplayer shooter built from "scratch" to study real-world game networking architecture.

[![TypeScript](https://img.shields.io/badge/TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-green.svg)](https://nodejs.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## About

This project is an **educational multiplayer game** designed to explore and implement advanced networking techniques used in commercial multiplayer games. It features a fully authoritative server architecture with client-side prediction, server reconciliation, and entity interpolation.

## Core Features(For now)

### Gameplay
- **Top-down shooter** with WASD movement and mouse aiming
- **Real-time PvP combat** with projectile-based shooting(for now)
- **Health system**: 100 HP, 20 damage per hit, death after 5 seconds

### Networking Architecture

#### Client-Side Prediction
```
Player inputs are applied immediately on the client for zero input lag,
then confirmed by the authoritative server.
```

#### Server Reconciliation
```
When server state differs from client prediction:
1. Reset to authoritative server position
2. Replay all unconfirmed inputs
3. Maintain smooth player experience
```

#### Entity Interpolation
```
Remote players and projectiles are rendered with adaptive delay buffer
(1.5 ticks behind server) for smooth movement despite network jitter.
```

#### Delta Compression
```
Only changed entities are sent per tick.
Full state sync every 2 seconds for resilience.
```

#### Camera Culling
```
Server only sends entities visible in each player's viewport + 100px padding.
Result: 0.2-0.3 entities/player average vs. hundreds without culling.
```

### Performance Optimizations

#### Spatial Hashing
- **200x200 cell grid** for efficient collision detection
- **Broad-phase optimization**: Only check neighboring cells (3x3)

#### Object Pooling
- Five distinct pools (Projectiles, Grid Cells, Snapshots, etc.) recycle objects to eliminate Garbage Collector spikes.

#### Broadcast Optimization
- **Entity Cell Cache**: Global entity-to-cell mapping computed once per tick
- **Visible Cells Cache**: Per-player visible cell set cached and updated only on camera movement
- **Message Object Pooling**: Reuse temporary objects instead of allocating new ones
- **Direct Cell Iteration**: Only iterate over visible cells instead of all entities

## Architecture

### Server Loop (30 TPS)
```
1. Process Inputs        → Apply player movements
2. Update Projectiles    → Move and check bounds
3. Collision Detection   → Spatial grid-based
4. Reaping               → Remove dead entities
5. Build Snapshot        → Create global state + entity cell cache
6. Broadcast Delta       → Send only visible changes to each player
```

### Client Loop (~60 FPS)
```
1. Capture Input         → WASD + Mouse
2. Apply Locally         → Client-side prediction
3. Send to Server        → 20Hz input rate, 10Hz camera updates
4. Receive State         → Delta decompression
5. Reconcile             → Replay unconfirmed inputs if needed
6. Interpolate           → Smooth remote entities (1.5 ticks behind)
7. Render                → Canvas 2D with culling
```

## Tech Stack

### Server
- **Runtime**: Node.js
- **Language**: TypeScript
- **WebSocket**: `ws`
- **Serialization**: `@msgpack/msgpack`
- **IDs**: `uuid`

### Client
- **Language**: TypeScript
- **Graphics**: Canvas 2D API
- **Serialization**: `@msgpack/msgpack`
- **Build Tool**: Vite

## Technical Deep Dives

### 1. Spatial Hashing Implementation

The collision system uses a **grid-based spatial hash** to avoid O(n²) checks.
The world is divided into a 200x200 grid. Instead of checking for collisions against all other entities (O(n²)), each entity only checks against those in its own grid cell and the 8 immediate neighbors (O(1) lookup).

### 2. Delta Compression

State changes are tracked using **entity hashing**. On the server, a lightweight hash is generated for every entity each tick. This hash is compared against the hash from the last snapshot sent to a specific player. If the hash is different, the entity is included in the delta packet. This ensures each player only receives what they don't already know.

### 3. Client-Side Prediction Flow

The client sends inputs with a sequence number. It applies inputs locally immediately. The server runs the input and sends back the result plus the sequence number it just processed (lastProcessedInput). The client discards all local inputs up to that number, resets its state to the server's state, and re-applies any inputs the server hasn't seen yet.

### 4. Adaptive Interpolation Delay

The client automatically adjusts interpolation delay based on network jitter. The client maintains a buffer of server snapshots. It tries to render entities ~1.5 ticks in the past to have data to interpolate between. It dynamically adjusts this delay, speeding up or slowing down time slightly (using DELAY_ADJUSTMENT_SPEED) to keep the buffer full without adding unnecessary latency.

## Learning Resources

This project implements techniques from:

- [Valve's Source Engine Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)
- [Gabriel Gambetta's Fast-Paced Multiplayer](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- [Overwatch Gameplay Architecture](https://www.youtube.com/watch?v=W3aieHjyNvw)
- [Riot Games' Netcode Guide](https://technology.riotgames.com/news/peeking-valorants-netcode)

## License

MIT License - feel free to use this code for learning purposes.

---

**⚠️ Note**: This is a learning project and **lacks production security features** (input validation, rate limiting, anti-cheat).

---

Made with ❤️ for learning game networking architecture.