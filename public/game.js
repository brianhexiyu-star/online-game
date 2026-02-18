const socket = io();

// ==================== CONFIGURATION ====================
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: {
        preload,
        create,
        update
    }
};

// ==================== CONSTANTS ====================
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const PLAYER_SPEED = 200;
const BULLET_SPEED = 500;
const PLAYER_PADDING = 16;
const NETWORK_UPDATE_RATE = 100;

// ==================== GAME STATE ====================
let game;
let players = {};
let playerGroup;
let bulletsGroup;
let landminesGroup;
let cursors;
let qKey;
let gameUI;
let lastSent = 0;
let preDirection = { x: 0, y: 0 };

// Cooldown tracking
let cooldowns = {
    shoot: 0,
    landmine: 0
};

// ==================== GAME INITIALIZATION ====================
game = new Phaser.Game(config);

// ==================== PRELOAD ====================
function preload() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    // Player texture
    graphics.fillStyle(0x00ffcc, 1);
    graphics.fillCircle(16, 16, 16);
    graphics.generateTexture('player', 32, 32);
    graphics.clear();

    // Bullet texture
    graphics.fillStyle(0xff5555, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('bullet', 8, 8);
    graphics.clear();

    // Landmine texture
    graphics.fillStyle(0xff6600, 1);
    graphics.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = 12 + Math.cos(angle) * 10;
        const y = 12 + Math.sin(angle) * 10;
        if (i === 0) graphics.moveTo(x, y);
        else graphics.lineTo(x, y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture('landmine', 24, 24);
    
    graphics.destroy();
}

// ==================== CREATE ====================
function create() {
    // World setup
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    
    // Background
    createBackground(this);
    
    // UI
    gameUI = new GameUI(this);
    
    // Input
    cursors = this.input.keyboard.createCursorKeys();
    qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    // Groups
    playerGroup = this.physics.add.group();
    bulletsGroup = this.physics.add.group({
        classType: Phaser.Physics.Arcade.Image
    });
    landminesGroup = this.physics.add.group({
        classType: Phaser.Physics.Arcade.Image
    });

    // Setup socket listeners
    setupSocketListeners(this);
    
    // Setup input handlers
    setupInputHandlers(this);

    // Setup visibility handler
    setupVisibilityHandler();

    // Request game state from server
    socket.emit('requestCurrentPlayers');
    socket.emit('requestNewPlayer');
    socket.emit('requestCurrentLandmines');
}

// ==================== VISIBILITY HANDLER ====================
function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('Tab visible - requesting sync');
            socket.emit('requestEntitySync');
        }
    });
}

// ==================== UPDATE LOOP ====================
function update() {
    const player = players[socket.id];
    if (!player) return;
    
    // Handle dead player
    if (player.health <= 0) {
        player.setTint(0xff5555);
        player.setVelocity(0, 0);
        return;
    }

    // Handle movement
    handlePlayerMovement(player);
    
    // Handle landmine placement
    handleLandminePlacement(this, player);
    
    // Clamp all players to bounds
    clampPlayersToBounds();
    
    // Send position updates
    sendPositionUpdate(player);
    
    // Update cooldowns
    updateCooldownUI();
    
    // Culling
    cullEntities(this);

    // Update nametags
    updateNametags();
    
    // Update UI
    gameUI.updateMinimap(players, socket.id, WORLD_WIDTH, WORLD_HEIGHT);
}

// ==================== COOLDOWN MANAGEMENT ====================
function updateCooldownUI() {
    const now = Date.now();
    
    // Update shoot cooldown
    if (cooldowns.shoot > now) {
        const remaining = cooldowns.shoot - now;
        gameUI.updateShootCooldown(remaining);
    } else {
        gameUI.updateShootCooldown(0);
    }
    
    // Update landmine cooldown
    if (cooldowns.landmine > now) {
        const remaining = cooldowns.landmine - now;
        gameUI.updateLandmineCooldown(remaining);
    } else {
        gameUI.updateLandmineCooldown(0);
    }
}

// ==================== SOCKET LISTENERS ====================
function setupSocketListeners(scene) {
    // Current players
    socket.on('currentPlayers', (serverPlayers) => {
        for (let id in serverPlayers) {
            addPlayer(scene, id, serverPlayers[id].x, serverPlayers[id].y, 
                     serverPlayers[id].health, serverPlayers[id].status, serverPlayers[id].name);
        }
        setupMyPlayerCollision(scene);
        
        const myPlayer = players[socket.id];
        if (myPlayer) {
            scene.cameras.main.startFollow(myPlayer, true, 0.1, 0.1);
            gameUI.updateHealth(myPlayer.health);
        }
        
        gameUI.updatePlayerCount(Object.keys(serverPlayers).length);
    });


    //setname

        socket.on('playerNameSet', (data) => {
            if (players[data.id]) {
                players[data.id].name = data.name;
                x= players[data.id].x;
                y= players[data.id].y; 
                      // Create nametag (name above player)
                const nametag = scene.add.text(x, y - 30, data.name, {
                    fontSize: '14px',
                    fontFamily: 'Arial',
                    color: '#ffffff',
                    backgroundColor: '#000000',
                    padding: { x: 6, y: 3 },
                    alpha: 0.8
                });
                nametag.setOrigin(0.5);
                nametag.setDepth(11);

                    // Create initial letter (in center of player)
                const initialText = scene.add.text(x, y, data.name.charAt(0).toUpperCase(), {
                    fontSize: '20px',
                    fontFamily: 'Arial',
                    color: '#0a0a15',
                    fontStyle: 'bold'
                });
                initialText.setOrigin(0.5);
                initialText.setDepth(11);

                    // Store references to nametag and initialText on the player object
                players[data.id].nametag = nametag;
                players[data.id].initialText = initialText;
            }
        });
    // Current landmines
    socket.on('currentLandmines', (serverLandmines) => {
        for (let id in serverLandmines) {
            const mineData = serverLandmines[id];
            spawnLandmine(scene, {
                id: id,
                x: mineData.x,
                y: mineData.y,
                owner: mineData.owner
            });
        }
    });

    

    // Entity sync
    socket.on('entitySync', (data) => {
        console.log(`Syncing ${Object.keys(data.bullets).length} bullets and ${Object.keys(data.landmines).length} landmines`);
        
        bulletsGroup.clear(true, true);
        for (let id in data.bullets) {
            spawnBullet(scene, data.bullets[id]);
        }
        
        landminesGroup.clear(true, true);
        for (let id in data.landmines) {
            spawnLandmine(scene, data.landmines[id]);
        }
    });

    // Rate limit feedback
    socket.on('shootDenied', (data) => {
        if (data.reason === 'cooldown') {
            console.log(`⏱️  Shoot on cooldown: ${data.waitTime}ms remaining`);
            cooldowns.shoot = Date.now() + data.waitTime;
        } else if (data.reason === 'max_bullets') {
            console.log(`⚠️  Max bullets reached: ${data.count}`);
            gameUI.showWarning('Too many bullets!');
        }
    });

    socket.on('landmineDenied', (data) => {
        if (data.reason === 'cooldown') {
            console.log(`⏱️  Landmine on cooldown: ${data.waitTime}ms remaining`);
            cooldowns.landmine = Date.now() + data.waitTime;
            gameUI.showWarning(`Landmine cooldown: ${Math.ceil(data.waitTime / 1000)}s`);
        } else if (data.reason === 'max_landmines') {
            console.log(`⚠️  Max landmines reached: ${data.count}`);
            gameUI.showWarning('Max landmines placed!');
        }
    });

    // New player
    socket.on('newPlayer', (data) => {
        addPlayer(scene, data.id, data.x, data.y, data.health, data.status, data.name);
        
        if (data.id === socket.id) {
            const myPlayer = players[socket.id];
            if (myPlayer) {
                scene.cameras.main.startFollow(myPlayer, true, 0.1, 0.1);
                gameUI.updateHealth(myPlayer.health);
            }
        }
        
        gameUI.updatePlayerCount(Object.keys(players).length);
    });

    // Player movement
    socket.on('playerMoved', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
            players[data.id].setVelocity(data.direction.x * PLAYER_SPEED, 
                                        data.direction.y * PLAYER_SPEED);
        }
    });

    // Player damaged
    socket.on('playerDamaged', (playerId, bulletsdirx, bulletsdiry) => {
        if (players[playerId]) {
            const player = players[playerId];
            player.x += bulletsdirx * 5;
            player.y += bulletsdiry * 5;
            
            if (playerId === socket.id && gameUI) {
                gameUI.updateHealth(player.health);
                gameUI.showDamageIndicator({ x: bulletsdirx, y: bulletsdiry });
            }
        }
    });
    
    // Player dead
    socket.on('playerDead', (playerId, bulletOwner) => { 
        if (players[playerId]) {
            const player = players[playerId];
            player.setTint(0xff5555);
            player.status = 'dead';
            player.health = 0;
            player.setVelocity(0, 0);
            
            if (playerId === socket.id && gameUI) {
                gameUI.updateHealth(0);
            }
            if (bulletOwner === socket.id && gameUI) {
                players[socket.id].k++;
                gameUI.updateKills(players[socket.id].k);
            }
        }
    });

    // Player disconnected
    socket.on('playerDisconnected', (id) => {
        if (players[id]) {
            players[id].destroy();
            delete players[id];
            gameUI.updatePlayerCount(Object.keys(players).length);
        }
    });

    // Bullet spawn
    socket.on('bulletSpawn', (data) => {
        spawnBullet(scene, data);
    });

    // Bullet removal
    socket.on('bulletRemove', (bulletId) => {
        bulletsGroup.children.each(b => {
            if (b.bulletId === bulletId) b.destroy();
        });
    });

    // Landmine spawn
    socket.on('landmineSpawn', (data) => {
        spawnLandmine(scene, data);
    });

    // Landmine explode
    socket.on('landmineExplode', (data) => {
        explodeLandmine(scene, data);
    });
}

// ==================== INPUT HANDLERS ====================
function setupInputHandlers(scene) {
    // Shooting
    scene.input.on('pointerdown', (pointer) => {
        if (pointer.leftButtonDown()) {
            shootProjectile(scene, pointer);
        }
    });
}

// ==================== PLAYER MANAGEMENT ====================


function addPlayer(scene, id, x, y, health, status, name) {
    const player = scene.physics.add.sprite(x, y, 'player');
    player.setCircle(16);
    player.setCollideWorldBounds(true);
    player.body.setBounce(0);
    player.playerId = id;
    player.health = health;
    player.status = status || 'alive';
    player.k = 0;


    


    player.nametag = '';
    player.initialText = '';

    if (status === 'dead') {
        player.setTint(0xff5555);
    }

    players[id] = player;
    playerGroup.add(player);
}

function handlePlayerMovement(player) {
    let direction = { x: 0, y: 0 };

    if (cursors.left.isDown) direction.x -= 1;
    if (cursors.right.isDown) direction.x += 1;
    if (cursors.up.isDown) direction.y -= 1;
    if (cursors.down.isDown) direction.y += 1;

    player.setVelocity(direction.x * PLAYER_SPEED, direction.y * PLAYER_SPEED);
    
    return direction;
}

function clampPlayersToBounds() {
    for (let id in players) {
        const player = players[id];
        player.x = Phaser.Math.Clamp(player.x, PLAYER_PADDING, WORLD_WIDTH - PLAYER_PADDING);
        player.y = Phaser.Math.Clamp(player.y, PLAYER_PADDING, WORLD_HEIGHT - PLAYER_PADDING);
    }
}

function sendPositionUpdate(player) {
    const now = Date.now();
    const direction = {
        x: cursors.left.isDown ? -1 : cursors.right.isDown ? 1 : 0,
        y: cursors.up.isDown ? -1 : cursors.down.isDown ? 1 : 0
    };

    if ((direction.x !== preDirection.x || direction.y !== preDirection.y) || 
        now - lastSent > NETWORK_UPDATE_RATE) {
        socket.emit('playerMovement', { 
            x: player.x, 
            y: player.y, 
            direction: direction 
        });
        preDirection = direction;
        lastSent = now;
    }
}

// ==================== COLLISION SETUP ====================
function setupMyPlayerCollision(scene) {
    const myPlayer = players[socket.id];
    if (!myPlayer) return;

    // Bullet collision
    scene.physics.add.overlap(
        bulletsGroup,
        myPlayer,
        (player, bullet) => {
            player.health -= 10;
            socket.emit('playerHit', { 
                playerId: socket.id, 
                bulletId: bullet.bulletId, 
                playerHealth: player.health 
            });
            
            gameUI.updateHealth(player.health);
            bullet.destroy();
        },
        (player, bullet) => bullet.owner !== socket.id,
        scene
    );

    // Landmine collision
    scene.physics.add.overlap(
        landminesGroup,
        myPlayer,
        (player, landmine) => {
            if (landmine.owner === socket.id) return;
            
            socket.emit('landmineHit', { 
                playerId: socket.id, 
                landmineId: landmine.landmineId,
                x: landmine.x,
                y: landmine.y
            });
        },
        null,
        scene
    );
}

// ==================== WEAPON SYSTEMS ====================
function shootProjectile(scene, pointer) {
    const player = players[socket.id];
    if (!player || player.health <= 0) return;

    const dir = new Phaser.Math.Vector2(
        pointer.worldX - player.x,
        pointer.worldY - player.y
    ).normalize();

    socket.emit('shoot', {
        x: player.x,
        y: player.y,
        dirX: dir.x,
        dirY: dir.y,
        speed: BULLET_SPEED
    });
}

function handleLandminePlacement(scene, player) {
    if (Phaser.Input.Keyboard.JustDown(qKey)) {
        socket.emit('placeLandmine', {
            x: player.x,
            y: player.y
        });
    }
}

function spawnBullet(scene, data) {
    const b = bulletsGroup.get(data.x, data.y, 'bullet');
    if (!b) return;

    b.setActive(true);
    b.setVisible(true);
    b.setCircle(4);
    b.bulletId = data.id;
    b.owner = data.owner;
    b.isExplosion = data.isExplosion || false;

    b.setVelocity(data.dirX * data.speed, data.dirY * data.speed);

    scene.time.addEvent({
        delay: 3000,
        callback: () => b.destroy()
    });
}

function spawnLandmine(scene, data) {
    const mine = landminesGroup.get(data.x, data.y, 'landmine');
    if (!mine) return;
    
    mine.setActive(true);
    mine.setVisible(true);
    mine.setCircle(10);
    mine.landmineId = data.id;
    mine.owner = data.owner;
    
    // Pulsing animation
    scene.tweens.add({
        targets: mine,
        scale: 1.2,
        duration: 500,
        yoyo: true,
        repeat: -1
    });
}

function explodeLandmine(scene, data) {
    landminesGroup.children.each(mine => {
        if (mine.landmineId === data.landmineId) {
            const explosion = scene.add.circle(mine.x, mine.y, 5, 0xff6600);
            explosion.setDepth(10);
            
            scene.tweens.add({
                targets: explosion,
                scale: 10,
                alpha: 0,
                duration: 500,
                onComplete: () => explosion.destroy()
            });
            
            mine.destroy();
        }
    });
}

// ==================== RENDERING & OPTIMIZATION ====================
function cullEntities(scene) {
    const cam = scene.cameras.main;
    const padding = 200;
    
    const viewBounds = {
        left: cam.scrollX - padding,
        right: cam.scrollX + cam.width + padding,
        top: cam.scrollY - padding,
        bottom: cam.scrollY + cam.height + padding
    };
    
    for (let id in players) {
        const p = players[id];
        const isVisible = p.x >= viewBounds.left && 
                         p.x <= viewBounds.right && 
                         p.y >= viewBounds.top && 
                         p.y <= viewBounds.bottom;
        
        p.setActive(isVisible);
        p.setVisible(isVisible);
    }
    
    bulletsGroup.children.each(bullet => {
        if (!bullet.active) return;
        
        const isVisible = bullet.x >= viewBounds.left && 
                         bullet.x <= viewBounds.right && 
                         bullet.y >= viewBounds.top && 
                         bullet.y <= viewBounds.bottom;
        
        bullet.setVisible(isVisible);
    });

    landminesGroup.children.each(mine => {
        if (!mine.active) return;
        
        const isVisible = mine.x >= viewBounds.left && 
                         mine.x <= viewBounds.right && 
                         mine.y >= viewBounds.top && 
                         mine.y <= viewBounds.bottom;
        
        mine.setVisible(isVisible);
    });
}

// ==================== BACKGROUND ====================
function createBackground(scene) {
    const graphics = scene.add.graphics();
    graphics.setDepth(-1);
    
    graphics.fillStyle(0x0f0f1e, 1);
    graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    
    graphics.lineStyle(2, 0x2a2a4e, 0.5);
    const gridSize = 100;
    
    for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
        graphics.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    
    for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
        graphics.lineBetween(0, y, WORLD_WIDTH, y);
    }
    
    graphics.lineStyle(1, 0x4a4a6e, 0.7);
    for (let x = 0; x <= WORLD_WIDTH; x += 500) {
        for (let y = 0; y <= WORLD_HEIGHT; y += 500) {
            graphics.strokeCircle(x, y, 5);
        }
    }
    
    graphics.lineStyle(6, 0xff3366, 1);
    graphics.strokeRect(2, 2, WORLD_WIDTH - 4, WORLD_HEIGHT - 4);
}

// ==================== nametag ====================
function updateNametags() {
    for (let id in players) {
        const player = players[id];
        if (player.nametag) {
            player.nametag.x = player.x;
            player.nametag.y = player.y - 30;
        }
        if (player.initialText) {
            player.initialText.x = player.x;
            player.initialText.y = player.y;
        }
    }
}
