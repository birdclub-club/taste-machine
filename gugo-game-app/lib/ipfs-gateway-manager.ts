// 🌐 Robust IPFS Gateway Manager with Health Tracking
// Automatically adapts to gateway outages and performance issues

interface GatewayHealth {
  url: string;
  successCount: number;
  failureCount: number;
  lastSuccess: number;
  lastFailure: number;
  avgResponseTime: number;
  isHealthy: boolean;
}

class IPFSGatewayManager {
  private static instance: IPFSGatewayManager;
  private gateways: GatewayHealth[] = [];
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly SUCCESS_THRESHOLD = 0.3; // 30% success rate (more forgiving)
  private readonly RECENT_WINDOW = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.initializeGateways();
    this.startHealthMonitoring();
  }

  static getInstance(): IPFSGatewayManager {
    if (!IPFSGatewayManager.instance) {
      IPFSGatewayManager.instance = new IPFSGatewayManager();
    }
    return IPFSGatewayManager.instance;
  }

  private initializeGateways() {
    // 🔒 SECURE & COMPATIBLE: HTTPS gateways for maximum compatibility
    const gatewayUrls = [
      'https://ipfs.io/ipfs/',             // Most reliable and secure
      'https://dweb.link/ipfs/',           // BEST for Final Bosu/Fugz (v1 hashes)
      'https://gateway.ipfs.io/ipfs/',     // Fast general purpose
      'https://4everland.io/ipfs/',        // Reliable alternative
      'https://w3s.link/ipfs/',            // Web3.Storage gateway
      'https://nftstorage.link/ipfs/',     // NFT.Storage gateway
      'https://pinata.cloud/ipfs/',        // Pinata gateway
      'https://ipfs.eth.aragon.network/ipfs/' // Aragon gateway
    ];

    this.gateways = gatewayUrls.map(url => ({
      url,
      successCount: 0,
      failureCount: 0,
      lastSuccess: 0,
      lastFailure: 0,
      avgResponseTime: 0,
      isHealthy: true
    }));
  }

  // 🎯 Get the best available gateway
  getBestGateway(): string {
    const healthyGateways = this.getHealthyGateways();
    
    if (healthyGateways.length === 0) {
      console.warn('⚠️ No healthy gateways found, using fallback');
      console.warn('🔍 Gateway status:', this.gateways.map(g => ({ url: g.url, healthy: g.isHealthy, failures: g.failureCount, successes: g.successCount })));
      return this.gateways[0]?.url || 'https://ipfs.io/ipfs/';
    }

    // Sort by success rate and response time
    const best = healthyGateways.sort((a, b) => {
      const aRate = this.getSuccessRate(a);
      const bRate = this.getSuccessRate(b);
      
      if (Math.abs(aRate - bRate) < 0.1) {
        // If success rates are similar, prefer faster gateway
        return a.avgResponseTime - b.avgResponseTime;
      }
      
      return bRate - aRate; // Higher success rate first
    })[0];

    return best.url;
  }

  // 📊 Get ordered list of gateways (best first)
  getOrderedGateways(): string[] {
    const healthy = this.getHealthyGateways();
    const unhealthy = this.gateways.filter(g => !g.isHealthy);
    
    // Sort healthy gateways by performance
    healthy.sort((a, b) => {
      const aRate = this.getSuccessRate(a);
      const bRate = this.getSuccessRate(b);
      return bRate - aRate;
    });

    // Combine healthy + unhealthy as fallback
    return [...healthy, ...unhealthy].map(g => g.url);
  }

  // ✅ Record successful gateway usage
  recordSuccess(gatewayUrl: string, responseTime: number = 0) {
    const gateway = this.gateways.find(g => g.url === gatewayUrl);
    if (!gateway) return;

    gateway.successCount++;
    gateway.lastSuccess = Date.now();
    
    // Update average response time
    if (responseTime > 0) {
      gateway.avgResponseTime = gateway.avgResponseTime === 0 
        ? responseTime 
        : (gateway.avgResponseTime + responseTime) / 2;
    }

    this.updateGatewayHealth(gateway);
    console.log(`✅ Gateway success: ${gatewayUrl} (${this.getSuccessRate(gateway).toFixed(1)}% success rate)`);
  }

  // ❌ Record gateway failure
  recordFailure(gatewayUrl: string, error?: string) {
    const gateway = this.gateways.find(g => g.url === gatewayUrl);
    if (!gateway) return;

    gateway.failureCount++;
    gateway.lastFailure = Date.now();
    
    this.updateGatewayHealth(gateway);
    console.log(`❌ Gateway failure: ${gatewayUrl} (${this.getSuccessRate(gateway).toFixed(1)}% success rate) - ${error || 'Unknown error'}`);
  }

  // 🔍 Update gateway health status
  private updateGatewayHealth(gateway: GatewayHealth) {
    const successRate = this.getSuccessRate(gateway);
    const recentFailure = Date.now() - gateway.lastFailure < this.RECENT_WINDOW;
    
    gateway.isHealthy = successRate >= this.SUCCESS_THRESHOLD && !recentFailure;
  }

  // 📈 Calculate success rate for a gateway
  private getSuccessRate(gateway: GatewayHealth): number {
    const total = gateway.successCount + gateway.failureCount;
    return total === 0 ? 1.0 : gateway.successCount / total;
  }

  // 🟢 Get only healthy gateways
  private getHealthyGateways(): GatewayHealth[] {
    return this.gateways.filter(g => g.isHealthy);
  }

  // 🔄 Start background health monitoring
  private healthCheckInterval?: NodeJS.Timeout;
  
  private startHealthMonitoring() {
    // Prevent multiple intervals
    if (this.healthCheckInterval) {
      console.log('🚫 Health monitoring already started, skipping...');
      return;
    }
    
    console.log('🏥 Starting gateway health monitoring (5-minute intervals)...');
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  // 🏥 Perform health check on all gateways
  private async performHealthCheck() {
    console.log('🏥 Performing gateway health check...');
    
    // Reset gateways that haven't been used recently
    const now = Date.now();
    this.gateways.forEach(gateway => {
      const timeSinceLastUse = Math.min(
        now - gateway.lastSuccess,
        now - gateway.lastFailure
      );
      
      // Reset health for unused gateways after 30 minutes
      if (timeSinceLastUse > 30 * 60 * 1000) {
        gateway.isHealthy = true;
        console.log(`🔄 Reset health for unused gateway: ${gateway.url}`);
      }
    });

    // Log current status
    const healthyCount = this.getHealthyGateways().length;
    console.log(`🏥 Health check complete: ${healthyCount}/${this.gateways.length} gateways healthy`);
  }

  // 📊 Get gateway statistics for debugging
  getStats(): { healthy: number; total: number; best: string; gateways: any[] } {
    const healthy = this.getHealthyGateways().length;
    const total = this.gateways.length;
    const best = this.getBestGateway();
    
    const gateways = this.gateways.map(g => ({
      url: g.url,
      healthy: g.isHealthy,
      successRate: this.getSuccessRate(g),
      responseTime: g.avgResponseTime,
      recentActivity: Math.max(g.lastSuccess, g.lastFailure)
    }));

    return { healthy, total, best, gateways };
  }

  // 🖥️ Print gateway status to console for debugging
  printStatus() {
    const stats = this.getStats();
    console.log('\n🌐 IPFS Gateway Health Status:');
    console.log(`📊 Overall: ${stats.healthy}/${stats.total} gateways healthy`);
    console.log(`🥇 Best gateway: ${stats.best.split('/')[2]}`);
    console.log('\n📋 Gateway Details:');
    
    stats.gateways
      .sort((a, b) => b.successRate - a.successRate)
      .forEach(g => {
        const status = g.healthy ? '🟢' : '🔴';
        const domain = g.url.split('/')[2];
        const rate = (g.successRate * 100).toFixed(1);
        const time = g.responseTime > 0 ? `${g.responseTime.toFixed(0)}ms` : 'N/A';
        console.log(`${status} ${domain}: ${rate}% success, ${time} avg`);
      });
      
    console.log('\n💡 Run `gatewayHealth()` anytime to check status\n');
  }
}

// 🌍 Global debug function - available in browser console
declare global {
  interface Window {
    gatewayHealth: () => void;
  }
}

// Export for browser console debugging
if (typeof window !== 'undefined') {
  window.gatewayHealth = () => ipfsGatewayManager.printStatus();
}

export const ipfsGatewayManager = IPFSGatewayManager.getInstance();

// Track logged hashes to avoid spam - static outside class
const loggedHashes = new Set<string>();

// 🔧 Enhanced IPFS URL fixer with collection-specific optimization
export const fixImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return '';
  
  if (imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    
    // 🎯 OPTIMIZED: Use secure HTTPS dweb.link for Final Bosu/Fugz (v1 hashes starting with 'bafy')
    if (ipfsHash.startsWith('bafybeie') || ipfsHash.startsWith('bafybeig')) {
      // Only log once per hash to avoid spam
      if (!loggedHashes.has(ipfsHash.substring(0,12))) {
        console.log(`🎯 Using optimized HTTPS gateway for Final Bosu/Fugz: ${ipfsHash.substring(0,12)}...`);
        loggedHashes.add(ipfsHash.substring(0,12));
      }
      return `https://dweb.link/ipfs/${ipfsHash}`;
    }
    
    const bestGateway = ipfsGatewayManager.getBestGateway();
    return `${bestGateway}${ipfsHash}`;
  }
  
  // Handle pinata URLs
  if (imageUrl.includes('pinata.cloud') && !imageUrl.includes('gateway.pinata.cloud')) {
    return imageUrl.replace('pinata.cloud', 'gateway.pinata.cloud');
  }
  
  // 🔍 Detect raw IPFS hashes (v0: Qm..., v1: bafy..., bafk..., etc.)
  const rawHashMatch = imageUrl.match(/^(?:https?:\/\/)?([Qm][1-9A-HJ-NP-Za-km-z]{44,}|b[a-z2-7]{58,})(?:\/(.+))?$/);
  if (rawHashMatch) {
    const ipfsHash = rawHashMatch[1];
    const filename = rawHashMatch[2] || '';
    const bestGateway = ipfsGatewayManager.getBestGateway();
    console.log(`🔧 Fixed raw IPFS hash: ${ipfsHash.substring(0, 20)}... → ${bestGateway.split('/')[2]}`);
    return `${bestGateway}${ipfsHash}` + (filename ? `/${filename}` : '');
  }
  
  return imageUrl;
};

// 🔄 Enhanced gateway retry with health tracking
export const getNextIPFSGateway = (currentSrc: string, originalUrl: string): string => {
  const gateways = ipfsGatewayManager.getOrderedGateways();
  
  // If already a placeholder, don't change it
  if (currentSrc.includes('picsum.photos')) {
    return currentSrc;
  }
  
  // Extract IPFS hash from current URL
  const ipfsMatch = currentSrc.match(/\/ipfs\/([^\/\?]+)(?:\/(.+))?/);
  
  // Try to detect raw IPFS hashes that might have slipped through
  if (!ipfsMatch) {
    const rawHashMatch = currentSrc.match(/^(?:https?:\/\/)?([Qm][1-9A-HJ-NP-Za-km-z]{44,}|b[a-z2-7]{58,})(?:\/(.+))?$/);
    if (rawHashMatch) {
      const ipfsHash = rawHashMatch[1];
      const filename = rawHashMatch[2] || '';
      const nextGateway = gateways[1] || gateways[0]; // Use second gateway, or first if only one
      return `${nextGateway}${ipfsHash}` + (filename ? `/${filename}` : '');
    }
  }

  if (!ipfsMatch) {
    // Generate placeholder for non-IPFS URLs
    const hash = Math.abs(originalUrl.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0));
    return `https://picsum.photos/400/400?random=${hash}`;
  }

  const ipfsHash = ipfsMatch[1];
  const filename = ipfsMatch[2] || '';
  const currentGateway = currentSrc.split('/ipfs/')[0] + '/ipfs/';
  const currentIndex = gateways.findIndex(gateway => gateway === currentGateway);

  // Record failure for current gateway
  ipfsGatewayManager.recordFailure(currentGateway, 'Image load failed');

  // Try next gateway
  if (currentIndex >= 0 && currentIndex < gateways.length - 1) {
    const nextGateway = gateways[currentIndex + 1];
    return `${nextGateway}${ipfsHash}` + (filename ? `/${filename}` : '');
  }

  // All gateways exhausted, use placeholder
  const hash = Math.abs(originalUrl.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0));
  return `https://picsum.photos/400/400?random=${hash}`;
};