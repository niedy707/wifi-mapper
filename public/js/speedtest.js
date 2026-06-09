/**
 * SpeedTest Module
 * LAN-based speed test: download, upload, latency, jitter
 * Tests against the local Node.js server (WiFi throughput measurement)
 */
const SpeedTest = (() => {
  const API_BASE = ''; // Same origin

  // ─── Download Speed Test ───────────────────────────────
  async function testDownload(sizeMB = 10) {
    const url = `${API_BASE}/api/speedtest/download?size=${sizeMB}&_=${Date.now()}`;

    const startTime = performance.now();
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) throw new Error('Download test failed');

    const reader = response.body.getReader();
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.length;
    }

    const endTime = performance.now();
    const durationSeconds = (endTime - startTime) / 1000;
    const mbps = (receivedBytes * 8) / (durationSeconds * 1000000);

    return {
      bytes: receivedBytes,
      duration: durationSeconds,
      mbps: Math.round(mbps * 100) / 100
    };
  }

  // ─── Upload Speed Test ─────────────────────────────────
  async function testUpload(sizeMB = 5) {
    const blob = new Blob([new Uint8Array(sizeMB * 1024 * 1024)]);

    const startTime = performance.now();
    const response = await fetch(`${API_BASE}/api/speedtest/upload?_=${Date.now()}`, {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': 'application/octet-stream' }
    });

    const endTime = performance.now();

    if (!response.ok) throw new Error('Upload test failed');

    const result = await response.json();
    const clientDuration = (endTime - startTime) / 1000;
    const clientMbps = (blob.size * 8) / (clientDuration * 1000000);

    return {
      bytes: blob.size,
      duration: clientDuration,
      mbps: Math.round(clientMbps * 100) / 100,
      serverMbps: result.mbps
    };
  }

  // ─── Latency Test ──────────────────────────────────────
  async function testLatency(iterations = 10) {
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fetch(`${API_BASE}/api/speedtest/ping?_=${Date.now()}_${i}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const end = performance.now();
      results.push(end - start);

      // Small delay between pings
      await new Promise(r => setTimeout(r, 50));
    }

    // Sort and take median
    results.sort((a, b) => a - b);
    const median = results[Math.floor(results.length / 2)];

    // Calculate jitter (average difference between consecutive pings)
    let jitterSum = 0;
    for (let i = 1; i < results.length; i++) {
      jitterSum += Math.abs(results[i] - results[i - 1]);
    }
    const jitter = results.length > 1 ? jitterSum / (results.length - 1) : 0;

    return {
      latency: Math.round(median * 100) / 100,
      jitter: Math.round(jitter * 100) / 100,
      min: Math.round(Math.min(...results) * 100) / 100,
      max: Math.round(Math.max(...results) * 100) / 100,
      samples: results
    };
  }

  // ─── Full Speed Test ───────────────────────────────────
  async function runFullTest(onProgress) {
    const result = {
      download: null,
      upload: null,
      latency: null,
      jitter: null,
      timestamp: new Date().toISOString()
    };

    try {
      // Step 1: Latency
      if (onProgress) onProgress('latency', 'running');
      const latencyResult = await testLatency(10);
      result.latency = latencyResult.latency;
      result.jitter = latencyResult.jitter;
      if (onProgress) onProgress('latency', 'done', latencyResult);

      // Step 2: Download
      if (onProgress) onProgress('download', 'running');
      const dlResult = await testDownload(10);
      result.download = dlResult.mbps;
      if (onProgress) onProgress('download', 'done', dlResult);

      // Step 3: Upload
      if (onProgress) onProgress('upload', 'running');
      const ulResult = await testUpload(5);
      result.upload = ulResult.mbps;
      if (onProgress) onProgress('upload', 'done', ulResult);

    } catch (err) {
      console.error('Speed test error:', err);
      if (onProgress) onProgress('error', 'error', err);
    }

    return result;
  }

  // ─── Public API ────────────────────────────────────────
  return {
    testDownload,
    testUpload,
    testLatency,
    runFullTest
  };
})();
