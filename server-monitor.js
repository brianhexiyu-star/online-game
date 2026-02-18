// server-monitor.js - Add this to your server to track performance
// Add these lines to your existing server code

const os = require('os');

// ==================== PERFORMANCE MONITORING ====================
class PerformanceMonitor {
    constructor(io) {
        this.io = io;
        this.startTime = Date.now();
        this.metrics = {
            totalConnections: 0,
            currentConnections: 0,
            messagesPerSecond: 0,
            messageCount: 0,
            lastMessageCount: 0,
            avgCpuUsage: 0,
            memoryUsage: 0
        };
        
        this.startMonitoring();
    }

    startMonitoring() {
        // Update metrics every second
        setInterval(() => {
            this.updateMetrics();
            this.logMetrics();
        }, 1000);

        // Detailed report every 10 seconds
        setInterval(() => {
            this.detailedReport();
        }, 10000);
    }

    updateMetrics() {
        // Messages per second
        this.metrics.messagesPerSecond = 
            this.metrics.messageCount - this.metrics.lastMessageCount;
        this.metrics.lastMessageCount = this.metrics.messageCount;

        // CPU usage
        const cpus = os.cpus();
        let totalIdle = 0, totalTick = 0;
        cpus.forEach(cpu => {
            for (let type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        this.metrics.avgCpuUsage = 
            ((1 - totalIdle / totalTick) * 100).toFixed(2);

        // Memory usage
        const used = process.memoryUsage();
        this.metrics.memoryUsage = {
            rss: (used.rss / 1024 / 1024).toFixed(2), // MB
            heap: (used.heapUsed / 1024 / 1024).toFixed(2) // MB
        };
    }

    logMetrics() {
        // Simple one-line update
        process.stdout.write(
            `\r👥 ${this.metrics.currentConnections} players | ` +
            `📨 ${this.metrics.messagesPerSecond} msg/s | ` +
            `💻 CPU: ${this.metrics.avgCpuUsage}% | ` +
            `🧠 RAM: ${this.metrics.memoryUsage.heap}MB`
        );
    }

    detailedReport() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        
        console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 SERVER PERFORMANCE REPORT`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`⏱️  Uptime: ${uptime}s`);
        console.log(`👥 Current Players: ${this.metrics.currentConnections}`);
        console.log(`📈 Total Connections: ${this.metrics.totalConnections}`);
        console.log(`📨 Messages/sec: ${this.metrics.messagesPerSecond}`);
        console.log(`💻 CPU Usage: ${this.metrics.avgCpuUsage}%`);
        console.log(`🧠 Memory (Heap): ${this.metrics.memoryUsage.heap}MB`);
        console.log(`🧠 Memory (Total): ${this.metrics.memoryUsage.rss}MB`);
        
        this.getPerformanceRating();
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }

    getPerformanceRating() {
        const { currentConnections, messagesPerSecond, avgCpuUsage } = this.metrics;
        
        let rating = '✅ EXCELLENT';
        let recommendation = 'Server running smoothly';

        if (currentConnections > 100 || messagesPerSecond > 1000 || avgCpuUsage > 50) {
            rating = '✓ GOOD';
            recommendation = 'Performance is acceptable';
        }
        
        if (currentConnections > 200 || messagesPerSecond > 2000 || avgCpuUsage > 70) {
            rating = '⚠️  WARNING';
            recommendation = 'Consider optimization or scaling';
        }
        
        if (currentConnections > 400 || messagesPerSecond > 4000 || avgCpuUsage > 85) {
            rating = '❌ CRITICAL';
            recommendation = 'URGENT: Server at capacity limit';
        }

        console.log(`\n${rating}`);
        console.log(`💡 ${recommendation}`);
    }

    trackMessage() {
        this.metrics.messageCount++;
    }

    trackConnection() {
        this.metrics.totalConnections++;
        this.metrics.currentConnections++;
    }

    trackDisconnection() {
        this.metrics.currentConnections--;
    }
}

// ==================== INTEGRATION EXAMPLE ====================
// Add this to your server code:

/*
// At the top of your server file, after io is created:
const monitor = new PerformanceMonitor(io);

// In your connection handler:
io.on('connection', (socket) => {
    monitor.trackConnection();
    console.log('User connected:', socket.id);
    
    // Track all messages
    socket.onAny(() => {
        monitor.trackMessage();
    });
    
    socket.on('disconnect', () => {
        monitor.trackDisconnection();
        console.log('User disconnected:', socket.id);
    });
    
    // ... rest of your code
});
*/

module.exports = PerformanceMonitor;
