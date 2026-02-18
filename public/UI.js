// UI.js - Game UI System
class GameUI {
    constructor(scene) {
        this.scene = scene;
        this.healthBar = null;
        this.healthText = null;
        this.killCount = 0;
        this.killText = null;
        this.minimap = null;
        this.playerCount = null;
        this.crosshair = null;
        this.damageIndicator = null;
        
        this.createUI();
    }
    
    createUI() {
        // Health bar background
        const healthBg = this.scene.add.graphics();
        healthBg.fillStyle(0x000000, 0.5);
        healthBg.fillRoundedRect(20, 20, 204, 34, 8);
        healthBg.setScrollFactor(0);
        healthBg.setDepth(100);
        
        // Health bar
        this.healthBar = this.scene.add.graphics();
        this.healthBar.setScrollFactor(0);
        this.healthBar.setDepth(101);
        
        // Health text
        this.healthText = this.scene.add.text(122, 37, '100 HP', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.healthText.setOrigin(0.5);
        this.healthText.setScrollFactor(0);
        this.healthText.setDepth(102);
        
        // Kill counter
        const killBg = this.scene.add.graphics();
        killBg.fillStyle(0x000000, 0.5);
        killBg.fillRoundedRect(20, 70, 150, 40, 8);
        killBg.setScrollFactor(0);
        killBg.setDepth(100);
        
        this.killText = this.scene.add.text(30, 80, '💀 Kills: 0', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ff3366',
            fontStyle: 'bold'
        });
        this.killText.setScrollFactor(0);
        this.killText.setDepth(101);
        
        // Player count (top right)
        const width = this.scene.cameras.main.width;
        this.playerCount = this.scene.add.text(width - 20, 20, '👥 Players: 1', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.playerCount.setOrigin(1, 0);
        this.playerCount.setScrollFactor(0);
        this.playerCount.setDepth(101);
        
        // Crosshair
        this.createCrosshair();
        
        // Minimap
        this.createMinimap();
        
        // Controls hint
        this.createControlsHint();
        
        // Listen for window resize
        this.scene.scale.on('resize', this.onResize, this);
    }
    
    createCrosshair() {
        this.crosshair = this.scene.add.graphics();
        this.crosshair.lineStyle(2, 0xff3366, 0.8);
        this.crosshair.setScrollFactor(0);
        this.crosshair.setDepth(1000);
        
        const size = 10;
        const gap = 5;
        
        // Update crosshair position on pointer move
        this.scene.input.on('pointermove', (pointer) => {
            this.crosshair.clear();
            this.crosshair.lineStyle(2, 0xff3366, 0.8);
            
            const x = pointer.x;
            const y = pointer.y;
            
            // Top line
            this.crosshair.lineBetween(x, y - gap - size, x, y - gap);
            // Bottom line
            this.crosshair.lineBetween(x, y + gap, x, y + gap + size);
            // Left line
            this.crosshair.lineBetween(x - gap - size, y, x - gap, y);
            // Right line
            this.crosshair.lineBetween(x + gap, y, x + gap + size, y);
            
            // Center dot
            this.crosshair.fillStyle(0xff3366, 0.5);
            this.crosshair.fillCircle(x, y, 2);
        });
    }
    
    createMinimap() {
        const mapSize = 150;
        const x = this.scene.cameras.main.width - mapSize - 20;
        const y = this.scene.cameras.main.height - mapSize - 20;
        
        // Minimap background
        const minimapBg = this.scene.add.graphics();
        minimapBg.fillStyle(0x000000, 0.7);
        minimapBg.fillRoundedRect(x, y, mapSize, mapSize, 8);
        minimapBg.setScrollFactor(0);
        minimapBg.setDepth(100);
        
        // Minimap border
        minimapBg.lineStyle(2, 0x00ffcc, 1);
        minimapBg.strokeRoundedRect(x, y, mapSize, mapSize, 8);
        
        this.minimap = {
            x: x,
            y: y,
            size: mapSize,
            graphics: minimapBg
        };
        
        // Title
        const minimapTitle = this.scene.add.text(x + mapSize / 2, y - 15, 'MAP', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        minimapTitle.setOrigin(0.5);
        minimapTitle.setScrollFactor(0);
        minimapTitle.setDepth(101);
    }
    
    createControlsHint() {
        const hints = this.scene.add.text(20, this.scene.cameras.main.height - 140, 
            '🎮 Controls:\n' +
            '⬆️⬇️⬅️➡️ Arrow Keys - Move\n' +
            '🖱️ Left Click - Shoot (4/sec)\n' +
            '💣 Q Key - Place Landmine (3s cooldown, max 5)', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 10, y: 10 },
            alpha: 0.7
        });
        hints.setScrollFactor(0);
        hints.setDepth(100);
        
        // Fade out after 10 seconds
        this.scene.time.delayedCall(10000, () => {
            this.scene.tweens.add({
                targets: hints,
                alpha: 0,
                duration: 1000,
                onComplete: () => hints.destroy()
            });
        });
    }
    
    updateShootCooldown(remaining) {
        // Visual feedback when shoot is on cooldown
        if (remaining > 0) {
            // Could show a cooldown bar here if needed
        }
    }
    
    updateLandmineCooldown(remaining) {
        // Visual feedback when landmine is on cooldown
        if (remaining > 0) {
            // Could show a cooldown bar here if needed
        }
    }
    
    showWarning(message) {
        const warning = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2 - 50,
            message,
            {
                fontSize: '24px',
                fontFamily: 'Arial',
                color: '#ff3366',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 },
                fontStyle: 'bold'
            }
        );
        warning.setOrigin(0.5);
        warning.setScrollFactor(0);
        warning.setDepth(1000);
        
        this.scene.tweens.add({
            targets: warning,
            alpha: 0,
            y: warning.y - 30,
            duration: 1500,
            onComplete: () => warning.destroy()
        });
    }
    
    updateHealth(health) {
        // Update health bar
        this.healthBar.clear();
        
        const maxHealth = 100;
        const percentage = Math.max(0, health / maxHealth);
        
        // Color based on health
        let color = 0x00ff00; // Green
        if (percentage < 0.5) color = 0xffaa00; // Orange
        if (percentage < 0.25) color = 0xff0000; // Red
        
        this.healthBar.fillStyle(color, 0.8);
        this.healthBar.fillRoundedRect(22, 22, 200 * percentage, 30, 6);
        
        // Update health text
        this.healthText.setText(`${Math.max(0, Math.floor(health))} HP`);
        
        // Flash effect on damage
        if (health < maxHealth) {
            this.healthText.setTint(0xff0000);
            this.scene.time.delayedCall(200, () => {
                this.healthText.clearTint();
            });
        }
    }
    
    updateKills(kills) {
        this.killCount = kills;
        this.killText.setText(`💀 Kills: ${kills}`);
        
        // Flash effect
        this.scene.tweens.add({
            targets: this.killText,
            scale: 1.2,
            duration: 100,
            yoyo: true
        });
    }
    
    updatePlayerCount(count) {
        this.playerCount.setText(`👥 Players: ${count}`);
    }
    
    updateMinimap(players, myPlayerId, worldWidth, worldHeight) {
        if (!this.minimap) return;
        
        const scale = this.minimap.size / Math.max(worldWidth, worldHeight);
        
        // Clear previous dots
        this.minimap.graphics.clear();
        this.minimap.graphics.fillStyle(0x000000, 0.7);
        this.minimap.graphics.fillRoundedRect(
            this.minimap.x, 
            this.minimap.y, 
            this.minimap.size, 
            this.minimap.size, 
            8
        );
        this.minimap.graphics.lineStyle(2, 0x00ffcc, 1);
        this.minimap.graphics.strokeRoundedRect(
            this.minimap.x, 
            this.minimap.y, 
            this.minimap.size, 
            this.minimap.size, 
            8
        );
        
        // Draw players
        for (let id in players) {
            const player = players[id];
            if (!player) continue;
            
            const minimapX = this.minimap.x + (player.x * scale);
            const minimapY = this.minimap.y + (player.y * scale);
            
            // Your player is cyan, others are red
            const color = id === myPlayerId ? 0x00ffcc : 0xff3366;
            
            this.minimap.graphics.fillStyle(color, 1);
            this.minimap.graphics.fillCircle(minimapX, minimapY, 3);
        }
    }
    
    showDamageIndicator(direction) {
        // Create a red flash from the direction of damage
        const angle = Math.atan2(direction.y, direction.x);
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;
        
        const indicator = this.scene.add.graphics();
        indicator.setScrollFactor(0);
        indicator.setDepth(999);
        
        indicator.fillStyle(0xff0000, 0.3);
        indicator.fillTriangle(
            centerX + Math.cos(angle) * 100, centerY + Math.sin(angle) * 100,
            centerX + Math.cos(angle + 0.5) * 50, centerY + Math.sin(angle + 0.5) * 50,
            centerX + Math.cos(angle - 0.5) * 50, centerY + Math.sin(angle - 0.5) * 50
        );
        
        this.scene.tweens.add({
            targets: indicator,
            alpha: 0,
            duration: 500,
            onComplete: () => indicator.destroy()
        });
    }
    
    onResize(gameSize) {
        // Update positions on resize
        if (this.playerCount) {
            this.playerCount.setPosition(gameSize.width - 20, 20);
        }
        
        if (this.minimap) {
            const mapSize = this.minimap.size;
            this.minimap.x = gameSize.width - mapSize - 20;
            this.minimap.y = gameSize.height - mapSize - 20;
        }
    }
    
    destroy() {
        this.scene.scale.off('resize', this.onResize, this);
    }
}

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameUI;
}