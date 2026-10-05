# Online Multiplayer Shooter

A browser-based multiplayer shooter built with JavaScript, Phaser, Express, and Socket.IO.

## Features

- Real-time multiplayer communication
- Phaser browser game client
- Server-side player and entity state
- Player movement and health synchronization
- Shooting and projectile synchronization
- Landmine and explosion mechanics
- Action cooldowns and per-player entity limits
- Automatic cleanup of expired bullets
- Load-testing and server-monitoring scripts
- LDtk map data

## Tech Stack

- Client: Phaser
- Server: Node.js, Express
- Networking: Socket.IO
- Map: LDtk

## Project Structure

~~~text
.
├── public/
├── server.js
├── server-monitor.js
├── load-test.js
├── newjsgamemap.ldtk
├── package.json
└── package-lock.json
~~~

## Running Locally

~~~bash
npm install
node server.js
~~~

The server listens on port 3000. Open http://localhost:3000 in a browser.

## Multiplayer Architecture

The server maintains shared state for players, bullets, landmines, and player cooldowns. Clients communicate through Socket.IO events while the server applies entity limits and synchronization rules.

## Prototype Protections

- 250 ms shooting cooldown
- 3 second landmine cooldown
- Maximum 15 active bullets per player
- Maximum 5 active landmines per player
- Automatic bullet cleanup after 3 seconds
- Cleanup of player-owned entities on disconnect

These are prototype-level controls rather than a production anti-cheat system.

## Purpose

This is a learning project focused on real-time game networking, multiplayer state synchronization, and practical server-side game logic.