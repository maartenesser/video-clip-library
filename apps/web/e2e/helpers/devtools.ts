import { CDPSession, Page } from '@playwright/test';

/**
 * Enable Chrome DevTools Performance monitoring
 */
export async function enablePerformanceMonitoring(page: Page): Promise<CDPSession> {
  const client: CDPSession = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  return client;
}

/**
 * Get current performance metrics from Chrome DevTools
 */
export async function getPerformanceMetrics(client: CDPSession) {
  const { metrics } = await client.send('Performance.getMetrics');
  return metrics;
}

/**
 * Network throttling presets
 */
const NETWORK_PRESETS = {
  slow3g: {
    downloadThroughput: 50000,
    uploadThroughput: 50000,
    latency: 2000,
  },
  fast3g: {
    downloadThroughput: 180000,
    uploadThroughput: 84000,
    latency: 562,
  },
  offline: {
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  },
};

/**
 * Enable network throttling to simulate slow connections
 */
export async function enableNetworkThrottling(
  client: CDPSession,
  preset: 'slow3g' | 'fast3g' | 'offline'
) {
  const config = NETWORK_PRESETS[preset];
  await client.send('Network.emulateNetworkConditions', {
    offline: preset === 'offline',
    downloadThroughput: config.downloadThroughput,
    uploadThroughput: config.uploadThroughput,
    latency: config.latency,
  });
}

/**
 * Disable network throttling
 */
export async function disableNetworkThrottling(client: CDPSession) {
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });
}

/**
 * Get JavaScript heap size metrics
 */
export async function getHeapMetrics(client: CDPSession) {
  const { metrics } = await client.send('Performance.getMetrics');
  const heapMetrics = metrics.filter(
    (m: { name: string }) =>
      m.name === 'JSHeapUsedSize' || m.name === 'JSHeapTotalSize'
  );
  return heapMetrics;
}

/**
 * Enable CPU throttling
 */
export async function enableCPUThrottling(client: CDPSession, rate: number) {
  await client.send('Emulation.setCPUThrottlingRate', { rate });
}

/**
 * Disable CPU throttling
 */
export async function disableCPUThrottling(client: CDPSession) {
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
