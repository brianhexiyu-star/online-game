// load-test.js - Simulate multiple players connecting
// Install: npm install socket.io-client

const io = require('socket.io-client');

// ==================== CONFIGURATION ====================
const SERVER_URL = 'http://localhost:3000';
const NUM_BOTS = 50; // Start with 50, increase gradually
const MOVEMENT_INTERVAL = 150; // ms between movements
const SHOOT_INTERVAL = 2000; // ms between shots

// ==================== BOT CLASS ====================
class Bot {
    constructor(id) {
        this.id = id;
        this.socket = null;
        this.x = 0;
        this.y = 0;
        this.connected = false;
        this.latency = 0;
    }

    connect() {
        this.socket = io(SERVER_URL);

        this.socket.on('connect', () => {
            console.log(`Bot ${this.id} connected`);
            this.connected = true;
            
            // Request to join game
            this.socket.emit('requestCurrentPlayers');
            this.socket.emit('requestNewPlayer');
            
            // Start behaviors
            this.startMoving();
            this.startShooting();
            this.measureLatency();
        });

        this.socket.on('currentPlayers', (players) => {
            if (players[this.socket.id]) {
                this.x = players[this.socket.id].x;
                this.y = players[this.socket.id].y;
            }
        });

        this.socket.on('disconnect', () => {
            console.log(`Bot ${this.id} disconnected`);
            this.connected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error(`Bot ${this.id} connection error:`, error.message);
        });
    }

    startMoving() {
        setInterval(() => {
            if (!this.connected) return;

            // Random movement
            const direction = {
                x: Math.random() > 0.5 ? 1 : Math.random() > 0.5 ? -1 : 0,
                y: Math.random() > 0.5 ? 1 : Math.random() > 0.5 ? -1 : 0
            };

            this.x += direction.x * 20;
            this.y += direction.y * 20;

            // Keep in bounds
            this.x = Math.max(16, Math.min(2984, this.x));
            this.y = Math.max(16, Math.min(2984, this.y));

            this.socket.emit('playerMovement', {
                x: this.x,
                y: this.y,
                direction: direction
            });
        }, MOVEMENT_INTERVAL);
    }

    startShooting() {
        setInterval(() => {
            if (!this.connected) return;

            // Random shooting direction
            const angle = Math.random() * Math.PI * 2;
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);

            this.socket.emit('shoot', {
                x: this.x,
                y: this.y,
                dirX: dirX,
                dirY: dirY,
                speed: 500
            });
        }, SHOOT_INTERVAL);
    }

    measureLatency() {
        setInterval(() => {
            if (!this.connected) return;

            const start = Date.now();
            this.socket.emit('ping', () => {
                this.latency = Date.now() - start;
            });
        }, 5000);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// ==================== LOAD TEST MANAGER ====================
class LoadTestManager {
    constructor() {
        this.bots = [];
        this.stats = {
            connected: 0,
            totalLatency: 0,
            errors: 0
        };
    }

    async spawnBots(count) {
        console.log(`\n🤖 Spawning ${count} bots...`);
        
        for (let i = 0; i < count; i++) {
            const bot = new Bot(i);
            this.bots.push(bot);
            bot.connect();
            
            // Stagger connections to avoid overwhelming server
            await this.sleep(100);
            
            if ((i + 1) % 10 === 0) {
                console.log(`  ✓ ${i + 1}/${count} bots spawned`);
            }
        }

        console.log(`\n✅ All ${count} bots spawned!`);
        this.startMonitoring();
    }

    startMonitoring() {
        console.log('\n📊 Monitoring server performance...\n');
        
        setInterval(() => {
            const connected = this.bots.filter(b => b.connected).length;
            const avgLatency = this.bots
                .filter(b => b.latency > 0)
                .reduce((sum, b) => sum + b.latency, 0) / connected || 0;

            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⏰ ${new Date().toLocaleTimeString()}`);
            console.log(`👥 Connected: ${connected}/${this.bots.length}`);
            console.log(`📡 Avg Latency: ${avgLatency.toFixed(2)}ms`);
            
            // Performance indicators
            if (avgLatency < 50) {
                console.log(`✅ EXCELLENT - Server handling load well`);
            } else if (avgLatency < 100) {
                console.log(`✓ GOOD - Acceptable performance`);
            } else if (avgLatency < 200) {
                console.log(`⚠️  WARNING - Starting to lag`);
            } else {
                console.log(`❌ CRITICAL - Severe lag detected`);
            }
            
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }, 5000);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    shutdown() {
        console.log('\n🛑 Shutting down all bots...');
        this.bots.forEach(bot => bot.disconnect());
        process.exit(0);
    }
}

// ==================== RUN TEST ====================
const manager = new LoadTestManager();

// Graceful shutdown
process.on('SIGINT', () => {
    manager.shutdown();
});

// Start test
console.log(`
╔════════════════════════════════════════╗
║     MULTIPLAYER GAME LOAD TESTER      ║
╚════════════════════════════════════════╝

Server: ${SERVER_URL}
Bots: ${NUM_BOTS}
Movement Rate: Every ${MOVEMENT_INTERVAL}ms
Shooting Rate: Every ${SHOOT_INTERVAL}ms

Press Ctrl+C to stop
`);

manager.spawnBots(NUM_BOTS);
