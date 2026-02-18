const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// ==================== GAME STATE ====================
let players = {};
let bullets = {};
let landmines = {};
let nextBulletId = 0;
let nextLandmineId = 0;

// ==================== RATE LIMITING ====================
const RATE_LIMITS = {
    SHOOT_COOLDOWN: 250,        // 250ms between shots (4 shots/sec max)
    LANDMINE_COOLDOWN: 3000,    // 3 seconds between landmines
    MAX_BULLETS_PER_PLAYER: 15, // Max 15 bullets active at once
    MAX_LANDMINES_PER_PLAYER: 5 // Max 5 landmines per player
};

// Track last action times per player
let playerCooldowns = {
    // [socketId]: { lastShot: timestamp, lastLandmine: timestamp }
};

// ==================== CONSTANTS ====================
const EXPLOSION_BULLET_COUNT = 16;
const EXPLOSION_BULLET_SPEED = 400;
const BULLET_LIFETIME = 3000; // 3 seconds max lifetime
const CLEANUP_INTERVAL = 2000; // Cleanup every 2 seconds

// ==================== BULLET CLEANUP SYSTEM ====================
function initCleanupSystem() {
    setInterval(() => {
        const now = Date.now();
        let removedCount = 0;

        // Remove old bullets
        for (let bulletId in bullets) {
            const bullet = bullets[bulletId];
            const age = now - bullet.createdAt;

            if (age > BULLET_LIFETIME) {
                delete bullets[bulletId];
                io.emit('bulletRemove', bulletId);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            console.log(`🧹 Cleaned up ${removedCount} old bullets. Total: ${Object.keys(bullets).length}`);
        }

        // Warn if too many entities
        const bulletCount = Object.keys(bullets).length;
        const landmineCount = Object.keys(landmines).length;

        if (bulletCount > 500) {
            console.log(`⚠️  Warning: ${bulletCount} bullets in memory!`);
        }
        if (landmineCount > 200) {
            console.log(`⚠️  Warning: ${landmineCount} landmines on map!`);
        }
    }, CLEANUP_INTERVAL);

    console.log('✅ Cleanup system initialized');
}

// ==================== RATE LIMIT HELPERS ====================
function canShoot(socketId) {
    const now = Date.now();
    
    // Initialize if doesn't exist
    if (!playerCooldowns[socketId]) {
        playerCooldowns[socketId] = { lastShot: 0, lastLandmine: 0 };
    }

    const timeSinceLastShot = now - playerCooldowns[socketId].lastShot;
    
    // Check cooldown
    if (timeSinceLastShot < RATE_LIMITS.SHOOT_COOLDOWN) {
        return {
            allowed: false,
            reason: 'cooldown',
            waitTime: RATE_LIMITS.SHOOT_COOLDOWN - timeSinceLastShot
        };
    }

    // Check max bullets
    const playerBulletCount = countPlayerBullets(socketId);
    if (playerBulletCount >= RATE_LIMITS.MAX_BULLETS_PER_PLAYER) {
        return {
            allowed: false,
            reason: 'max_bullets',
            count: playerBulletCount
        };
    }

    return { allowed: true };
}

function canPlaceLandmine(socketId) {
    const now = Date.now();
    
    // Initialize if doesn't exist
    if (!playerCooldowns[socketId]) {
        playerCooldowns[socketId] = { lastShot: 0, lastLandmine: 0 };
    }

    const timeSinceLastMine = now - playerCooldowns[socketId].lastLandmine;
    
    // Check cooldown
    if (timeSinceLastMine < RATE_LIMITS.LANDMINE_COOLDOWN) {
        return {
            allowed: false,
            reason: 'cooldown',
            waitTime: RATE_LIMITS.LANDMINE_COOLDOWN - timeSinceLastMine
        };
    }

    // Check max landmines
    const playerMineCount = countPlayerLandmines(socketId);
    if (playerMineCount >= RATE_LIMITS.MAX_LANDMINES_PER_PLAYER) {
        return {
            allowed: false,
            reason: 'max_landmines',
            count: playerMineCount
        };
    }

    return { allowed: true };
}

function countPlayerBullets(socketId) {
    let count = 0;
    for (let id in bullets) {
        if (bullets[id].owner === socketId) {
            count++;
        }
    }
    return count;
}

function countPlayerLandmines(socketId) {
    let count = 0;
    for (let id in landmines) {
        if (landmines[id].owner === socketId) {
            count++;
        }
    }
    return count;
}

function updateCooldown(socketId, action) {
    if (!playerCooldowns[socketId]) {
        playerCooldowns[socketId] = { lastShot: 0, lastLandmine: 0 };
    }

    if (action === 'shoot') {
        playerCooldowns[socketId].lastShot = Date.now();
    } else if (action === 'landmine') {
        playerCooldowns[socketId].lastLandmine = Date.now();
    }
}

// ==================== CONNECTION HANDLER ====================
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Spawn player at random position
    const spawnX = Math.random() * 2500 + 250;
    const spawnY = Math.random() * 2500 + 250;
    
    players[socket.id] = { 
        x: spawnX, 
        y: spawnY, 
        health: 100, 
        status: 'alive' 
    };

    // Initialize cooldowns
    playerCooldowns[socket.id] = { lastShot: 0, lastLandmine: 0 };

    // ==================== PLAYER EVENTS ====================
    socket.on('requestCurrentPlayers', () => {
        socket.emit('currentPlayers', players);
    });

    socket.on('requestNewPlayer', () => {
        socket.broadcast.emit('newPlayer', { 
            id: socket.id, 
            x: players[socket.id].x, 
            y: players[socket.id].y,
            health: players[socket.id].health,
            status: players[socket.id].status
        });
    });

    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('playerMoved', { 
                id: socket.id, 
                x: data.x, 
                y: data.y, 
                direction: data.direction 
            });
        }
    });

    // ==================== SHOOTING EVENTS ====================
    socket.on('shoot', (data) => {
        // Check rate limit
        const canFire = canShoot(socket.id);
        
        if (!canFire.allowed) {
            // Send error to client
            socket.emit('shootDenied', {
                reason: canFire.reason,
                waitTime: canFire.waitTime,
                count: canFire.count
            });
            return;
        }

        // Create bullet
        const bulletId = nextBulletId++;
        bullets[bulletId] = {
            id: bulletId,
            owner: socket.id,
            x: data.x,
            y: data.y,
            dirX: data.dirX,
            dirY: data.dirY,
            speed: data.speed,
            isExplosion: false,
            createdAt: Date.now() // For cleanup
        };

        // Update cooldown
        updateCooldown(socket.id, 'shoot');

        // Broadcast bullet
        io.emit('bulletSpawn', bullets[bulletId]);
    });

    socket.on('playerHit', ({ playerId, bulletId, playerHealth }) => {
        if (!bullets[bulletId]) {
            return;
        }

        const bulletDirX = bullets[bulletId].dirX;
        const bulletDirY = bullets[bulletId].dirY;
        const bulletOwner = bullets[bulletId].owner;

        delete bullets[bulletId];
        io.emit('bulletRemove', bulletId);

        if (players[playerId]) {
            players[playerId].health = playerHealth;

            if (playerHealth <= 0) {
                players[playerId].status = 'dead';
                players[playerId].health = 0;
                io.emit('playerDead', playerId, bulletOwner);
                console.log(`Player ${playerId} killed by ${bulletOwner}`);
            } else {
                io.emit('playerDamaged', playerId, bulletDirX, bulletDirY);
            }
        }
    }); 

    // ==================== LANDMINE EVENTS ====================
    socket.on('requestCurrentLandmines', () => {
        socket.emit('currentLandmines', landmines);
    });

    socket.on('requestEntitySync', () => {
        socket.emit('entitySync', {
            bullets: bullets,
            landmines: landmines
        });
    });
    
    socket.on('placeLandmine', (data) => {
        // Check rate limit
        const canPlace = canPlaceLandmine(socket.id);
        
        if (!canPlace.allowed) {
            // Send error to client
            socket.emit('landmineDenied', {
                reason: canPlace.reason,
                waitTime: canPlace.waitTime,
                count: canPlace.count
            });
            return;
        }

        // Create landmine
        const landmineId = nextLandmineId++;
        landmines[landmineId] = {
            id: landmineId,
            owner: socket.id,
            x: data.x,
            y: data.y,
            createdAt: Date.now() // For tracking
        };

        // Update cooldown
        updateCooldown(socket.id, 'landmine');

        console.log(`Player ${socket.id} placed landmine ${landmineId} (${countPlayerLandmines(socket.id)}/${RATE_LIMITS.MAX_LANDMINES_PER_PLAYER})`);
        
        io.emit('landmineSpawn', landmines[landmineId]);
    });

    socket.on('landmineHit', ({ playerId, landmineId }) => {
        if (!landmines[landmineId]) {
            return;
        }

        const landmineOwner = landmines[landmineId].owner;
        const landmineX = landmines[landmineId].x;
        const landmineY = landmines[landmineId].y;

        // Remove landmine
        delete landmines[landmineId];
        
        // Notify explosion
        io.emit('landmineExplode', { 
            landmineId: landmineId,
            x: landmineX,
            y: landmineY
        });

        // Kill the player who stepped on it
        if (players[playerId]) {
            players[playerId].health = 0;
            players[playerId].status = 'dead';
            io.emit('playerDead', playerId, landmineOwner);
            console.log(`Player ${playerId} killed by landmine from ${landmineOwner}`);
        }

        // Create circular explosion bullets
        createExplosionBullets(landmineX, landmineY, landmineOwner, playerId);
    });

    // ==================== DISCONNECT ====================
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        delete playerCooldowns[socket.id];
        io.emit('playerDisconnected', socket.id);

        // Remove bullets owned by this player
        let removedBullets = 0;
        for (let id in bullets) {
            if (bullets[id].owner === socket.id) {
                delete bullets[id];
                io.emit('bulletRemove', id);
                removedBullets++;
            }
        }

        // Remove landmines owned by this player
        let removedMines = 0;
        for (let id in landmines) {
            if (landmines[id].owner === socket.id) {
                delete landmines[id];
                io.emit('landmineExplode', { landmineId: id, x: 0, y: 0 });
                removedMines++;
            }
        }

        if (removedBullets > 0 || removedMines > 0) {
            console.log(`  Cleaned: ${removedBullets} bullets, ${removedMines} landmines`);
        }
    });
});

// ==================== HELPER FUNCTIONS ====================
function createExplosionBullets(x, y, owner, deadPlayerId) {
    const angleStep = (Math.PI * 2) / EXPLOSION_BULLET_COUNT;
    
    for (let i = 0; i < EXPLOSION_BULLET_COUNT; i++) {
        const angle = angleStep * i;
        const bulletId = nextBulletId++;
        bullets[bulletId] = {
            id: bulletId,
            owner: owner,
            x: x,
            y: y,
            dirX: Math.cos(angle),
            dirY: Math.sin(angle),
            speed: EXPLOSION_BULLET_SPEED,
            isExplosion: true,
            ignorePlayer: deadPlayerId,
            createdAt: Date.now()
        };

        io.emit('bulletSpawn', bullets[bulletId]);
    }

    console.log(`💥 Created ${EXPLOSION_BULLET_COUNT} explosion bullets`);
}

// ==================== SERVER START ====================
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║   MULTIPLAYER SHOOTER SERVER v3.0     ║
╚════════════════════════════════════════╝

🌐 Server: http://0.0.0.0:${PORT}
🌐 Local:  http://10.10.52.52:${PORT}

⚙️  RATE LIMITS:
   🔫 Shoot cooldown: ${RATE_LIMITS.SHOOT_COOLDOWN}ms
   💣 Landmine cooldown: ${RATE_LIMITS.LANDMINE_COOLDOWN}ms
   📊 Max bullets/player: ${RATE_LIMITS.MAX_BULLETS_PER_PLAYER}
   📊 Max landmines/player: ${RATE_LIMITS.MAX_LANDMINES_PER_PLAYER}

🧹 Cleanup: Every ${CLEANUP_INTERVAL}ms
⏱️  Bullet lifetime: ${BULLET_LIFETIME}ms
    `);

    // Initialize cleanup system
    initCleanupSystem();
});