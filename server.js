const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3333;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(cors());
// Skip JSON body parsing for upload speed test (needs raw stream access)
app.use((req, res, next) => {
  if (req.path === '/api/speedtest/upload') return next();
  express.json({ limit: '50mb' })(req, res, next);
});
app.use(express.static(path.join(__dirname, 'public')));

// ─── WiFi Scanning ───────────────────────────────────────────────

/**
 * Parse system_profiler SPAirPortDataType output
 * Extracts current network info: SSID, signal, noise, channel, band, etc.
 */
function parseWifiInfo(stdout) {
  const result = {
    currentNetwork: null,
    availableNetworks: []
  };

  try {
    // Parse current network information
    const lines = stdout.split('\n');
    let inCurrentNetwork = false;
    let currentNetworkName = '';
    let currentData = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect "Current Network Information:" section
      if (trimmed === 'Current Network Information:') {
        inCurrentNetwork = true;
        continue;
      }

      if (inCurrentNetwork) {
        // Network name is the next indented line ending with ':'
        if (!currentNetworkName && trimmed.endsWith(':') && !trimmed.includes('PHY Mode') && !trimmed.includes('Channel')) {
          currentNetworkName = trimmed.replace(':', '').trim();
          continue;
        }

        // Parse key-value pairs
        if (trimmed.includes(':')) {
          const colonIndex = trimmed.indexOf(':');
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();

          switch (key) {
            case 'PHY Mode':
              currentData.phyMode = value;
              break;
            case 'Channel':
              currentData.channelRaw = value;
              // Parse channel number and width
              const channelMatch = value.match(/(\d+)/);
              if (channelMatch) {
                currentData.channel = parseInt(channelMatch[1]);
              }
              // Extract band directly from raw string (e.g., "36 (5GHz, 80MHz)")
              const bandMatch = value.match(/\(([\d.]+GHz)/i);
              if (bandMatch) {
                currentData.band = bandMatch[1];
              } else if (currentData.channel) {
                currentData.band = currentData.channel >= 36 ? '5GHz' : '2.4GHz';
              }
              // Extract channel width
              const widthMatch = value.match(/(\d+)MHz/);
              if (widthMatch) {
                currentData.channelWidth = parseInt(widthMatch[1]);
              }
              break;
            case 'Network Type':
              currentData.networkType = value;
              break;
            case 'Security':
              currentData.security = value;
              break;
            case 'Signal / Noise':
              const signalMatch = value.match(/(-?\d+)\s*dBm\s*\/\s*(-?\d+)\s*dBm/);
              if (signalMatch) {
                currentData.signal = parseInt(signalMatch[1]);
                currentData.noise = parseInt(signalMatch[2]);
                currentData.snr = currentData.signal - currentData.noise;
              }
              break;
            case 'Transmit Rate':
              const rateMatch = value.match(/([\d.]+)/);
              if (rateMatch) {
                currentData.txRate = parseFloat(rateMatch[1]);
              }
              break;
            case 'MCS Index':
              currentData.mcsIndex = parseInt(value) || 0;
              break;
          }
        }

        // If we hit "Other Local Wi-Fi Networks" or another major section, stop
        if (trimmed === 'Other Local Wi-Fi Networks:' || trimmed === 'Other Known Networks:') {
          inCurrentNetwork = false;
        }
      }

      // Parse available networks
      if (trimmed === 'Other Local Wi-Fi Networks:') {
        // Parse subsequent network entries
        let j = i + 1;
        let netName = '';
        let netData = {};

        while (j < lines.length) {
          const netLine = lines[j].trim();

          if (netLine === '' || (!netLine.includes(':') && !netLine.endsWith(':'))) {
            if (netName && Object.keys(netData).length > 0) {
              result.availableNetworks.push({ ssid: netName, ...netData });
              netName = '';
              netData = {};
            }
            if (netLine === '') { j++; continue; }
          }

          // Check if this is a new section header (not indented enough)
          if (!lines[j].startsWith('            ') && !lines[j].startsWith('\t\t\t') && netLine.endsWith(':') && !netLine.includes('PHY Mode') && !netLine.includes('Channel') && !netLine.includes('Signal')) {
            if (netName && Object.keys(netData).length > 0) {
              result.availableNetworks.push({ ssid: netName, ...netData });
            }
            netName = netLine.replace(':', '').trim();
            netData = {};
            j++;
            continue;
          }

          if (netLine.includes(':')) {
            const colonIdx = netLine.indexOf(':');
            const k = netLine.substring(0, colonIdx).trim();
            const v = netLine.substring(colonIdx + 1).trim();

            if (k === 'PHY Mode') netData.phyMode = v;
            if (k === 'Channel') {
              const ch = v.match(/(\d+)/);
              if (ch) {
                netData.channel = parseInt(ch[1]);
                netData.band = netData.channel >= 36 ? '5GHz' : '2.4GHz';
                if (netData.channel > 177) netData.band = '6GHz';
              }
            }
            if (k === 'Signal / Noise') {
              const sm = v.match(/(-?\d+)\s*dBm\s*\/\s*(-?\d+)\s*dBm/);
              if (sm) {
                netData.signal = parseInt(sm[1]);
                netData.noise = parseInt(sm[2]);
                netData.snr = netData.signal - netData.noise;
              }
            }
            if (k === 'Security') netData.security = v;
          }

          j++;
          // Stop if we hit another major section
          if (netLine.startsWith('Known Networks:') || netLine.startsWith('Bluetooth:')) break;
        }

        if (netName && Object.keys(netData).length > 0) {
          result.availableNetworks.push({ ssid: netName, ...netData });
        }
      }
    }

    if (currentNetworkName) {
      // macOS Sequoia redacts SSID for privacy
      let ssid = currentNetworkName;
      if (ssid === '<redacted>' || ssid.includes('redacted') || ssid.includes('Redacted')) {
        ssid = 'Bağlı Ağ';
      }
      result.currentNetwork = {
        ssid,
        ...currentData
      };
    }
  } catch (err) {
    console.error('WiFi parse error:', err);
  }

  return result;
}

// GET /api/wifi/scan — Get current WiFi connection info
app.get('/api/wifi/scan', (req, res) => {
  const binaryPath = path.join(__dirname, 'wifi_scanner');
  
  // Try native fast Swift scanner first
  exec(`"${binaryPath}"`, { timeout: 3000 }, (swiftErr, swiftStdout, swiftStderr) => {
    if (!swiftErr && swiftStdout) {
      try {
        const parsed = JSON.parse(swiftStdout.trim());
        if (parsed && !parsed.error && parsed.signal !== undefined) {
          return res.json({
            timestamp: new Date().toISOString(),
            ...parsed
          });
        }
      } catch (parseErr) {
        console.warn('Swift scanner output parse error, falling back to system_profiler:', parseErr);
      }
    }

    // Fallback to slow system_profiler SPAirPortDataType
    console.log('Falling back to system_profiler SPAirPortDataType for current WiFi scan...');
    exec('system_profiler SPAirPortDataType', { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('WiFi scan error:', error.message);
        return res.status(500).json({ error: 'WiFi taraması başarısız', details: error.message });
      }

      const parsed = parseWifiInfo(stdout);

      if (!parsed.currentNetwork) {
        return res.status(404).json({ error: 'WiFi bağlantısı bulunamadı' });
      }

      res.json({
        timestamp: new Date().toISOString(),
        ...parsed.currentNetwork
      });
    });
  });
});

// GET /api/wifi/scan-all — Get all visible networks
app.get('/api/wifi/scan-all', (req, res) => {
  exec('system_profiler SPAirPortDataType', { timeout: 15000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'WiFi taraması başarısız', details: error.message });
    }

    const parsed = parseWifiInfo(stdout);
    const allNetworks = [];

    if (parsed.currentNetwork) {
      allNetworks.push({ ...parsed.currentNetwork, isCurrent: true });
    }

    parsed.availableNetworks.forEach(net => {
      allNetworks.push({ ...net, isCurrent: false });
    });

    res.json({
      timestamp: new Date().toISOString(),
      networks: allNetworks
    });
  });
});

// ─── Speed Test Endpoints ────────────────────────────────────────

// GET /api/speedtest/download — Send a large blob for download speed test
app.get('/api/speedtest/download', (req, res) => {
  const size = parseInt(req.query.size) || 10; // MB
  const bytes = size * 1024 * 1024;

  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': bytes,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'X-Start-Time': Date.now().toString()
  });

  // Generate and send random data in chunks for memory efficiency
  const chunkSize = 1024 * 1024; // 1MB chunks
  let remaining = bytes;

  function sendChunk() {
    if (remaining <= 0) {
      res.end();
      return;
    }
    const currentChunk = Math.min(chunkSize, remaining);
    const buffer = crypto.randomBytes(currentChunk);
    remaining -= currentChunk;

    const canContinue = res.write(buffer);
    if (canContinue) {
      setImmediate(sendChunk);
    } else {
      res.once('drain', sendChunk);
    }
  }

  sendChunk();
});

// POST /api/speedtest/upload — Receive data for upload speed test
app.post('/api/speedtest/upload', (req, res) => {
  let receivedBytes = 0;
  const startTime = Date.now();

  req.on('data', (chunk) => {
    receivedBytes += chunk.length;
  });

  req.on('end', () => {
    const duration = (Date.now() - startTime) / 1000;
    const mbps = (receivedBytes * 8) / (duration * 1000000);

    res.json({
      receivedBytes,
      durationSeconds: duration,
      mbps: Math.round(mbps * 100) / 100
    });
  });
});

// HEAD /api/speedtest/ping — Minimal latency measurement
app.head('/api/speedtest/ping', (req, res) => {
  res.set({
    'Cache-Control': 'no-store',
    'X-Server-Time': Date.now().toString()
  });
  res.status(200).end();
});

// GET /api/speedtest/ping — For browsers that don't support HEAD well
app.get('/api/speedtest/ping', (req, res) => {
  res.set({ 'Cache-Control': 'no-store' });
  res.json({ t: Date.now() });
});

// ─── Project CRUD ────────────────────────────────────────────────

function getProjectsFile() {
  return path.join(DATA_DIR, 'projects.json');
}

function loadProjects() {
  const file = getProjectsFile();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveProjects(projects) {
  fs.writeFileSync(getProjectsFile(), JSON.stringify(projects, null, 2), 'utf8');
}

// GET /api/projects
app.get('/api/projects', (req, res) => {
  res.json(loadProjects());
});

// POST /api/projects
app.post('/api/projects', (req, res) => {
  const projects = loadProjects();
  const { v4: uuidv4 } = require('uuid');

  const newProject = {
    id: uuidv4(),
    name: req.body.name || 'Yeni Proje',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    floorplan: req.body.floorplan || null,
    floorplanDrawing: req.body.floorplanDrawing || null,
    scale: req.body.scale || null,
    measurements: req.body.measurements || [],
    routers: req.body.routers || []
  };

  projects.push(newProject);
  saveProjects(projects);
  res.status(201).json(newProject);
});

// GET /api/projects/:id
app.get('/api/projects/:id', (req, res) => {
  const projects = loadProjects();
  const project = projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });
  res.json(project);
});

// PUT /api/projects/:id
app.put('/api/projects/:id', (req, res) => {
  const projects = loadProjects();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Proje bulunamadı' });

  projects[idx] = {
    ...projects[idx],
    ...req.body,
    id: projects[idx].id,
    createdAt: projects[idx].createdAt,
    updatedAt: new Date().toISOString()
  };

  saveProjects(projects);
  res.json(projects[idx]);
});

// DELETE /api/projects/:id
app.delete('/api/projects/:id', (req, res) => {
  let projects = loadProjects();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Proje bulunamadı' });

  const deleted = projects.splice(idx, 1);
  saveProjects(projects);
  res.json(deleted[0]);
});

// ─── Start Server ────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║                                          ║');
    console.log('  ║   🛜  WifiMapper Server                  ║');
    console.log(`  ║   📡 http://localhost:${PORT}              ║`);
    console.log('  ║                                          ║');
    console.log('  ║   WiFi Heatmap & Survey Tool             ║');
    console.log('  ║   NetSpot Alternative — Free & Local     ║');
    console.log('  ║                                          ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
  });
}

module.exports = app;
