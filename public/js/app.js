/**
 * App — Main Application Controller
 * Wires together all modules: FloorPlan, Survey, HeatmapEngine, SpeedTest, Export
 */
const App = (() => {
  const API_BASE = '';
  let currentProjectId = null;
  let isMeasuring = false;
  let measureCancelled = false;
  let pendingTextPos = null;
  let pendingRouterPos = null;
  let originalPinsVisible = true;

  // WiFi status polling interval
  let wifiPollTimer = null;

  // ─── Boot ──────────────────────────────────────────────
  function boot() {
    // Initialize modules
    FloorPlan.init({
      onTransformChange: handleTransformChange,
      onCanvasClick: handleCanvasClick,
      onDrawingChange: triggerAutosave,
      onShapeDoubleClick: handleShapeDoubleClick
    });
    Survey.init();
    HeatmapEngine.init();

    // Bind UI
    bindToolbar();
    bindFloorplanUpload();
    bindHeatmapControls();
    bindZoomControls();
    bindProjectControls();
    bindExportControls();
    bindMeasurementControls();
    bindModalControls();
    bindRouterControls();
    bindAiControls();
    bindRoomPolygonControls();

    // Start WiFi status polling
    pollWifiStatus();
    wifiPollTimer = setInterval(pollWifiStatus, 5000);

    // Load projects
    loadProjectsList();

    // Mobile & device setup
    setupDeviceBadge();
    bindMobileControls();

    console.log('WifiMapper booted ✓');
  }

  // ─── WiFi Status Polling ───────────────────────────────
  async function pollWifiStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/wifi/scan`);
      if (!res.ok) throw new Error('scan failed');
      const data = await res.json();

      // Update header status
      const statusDot = document.querySelector('#wifi-status .status-dot');
      const statusText = document.querySelector('#wifi-status .status-text');

      if (statusDot) {
        statusDot.className = 'status-dot online';
      }
      if (statusText) {
        const ssid = data.ssid || 'Bağlı Ağ';
        const band = data.band || '?';
        const channel = data.channel || '?';
        const txRate = data.txRate ? `${data.txRate} Mbps` : '?';
        const signal = data.signal !== undefined ? `${data.signal} dBm` : '?';
        statusText.textContent = `${ssid} (${band}) • Kanal ${channel} • Sinyal: ${signal} • Hız: ${txRate}`;
      }

      // Update right panel
      setField('info-ssid', data.ssid);
      setField('info-signal', data.signal !== undefined ? `${data.signal} dBm` : '—');
      setField('info-noise', data.noise !== undefined ? `${data.noise} dBm` : '—');
      setField('info-snr', data.snr !== undefined ? `${data.snr} dB` : '—');
      setField('info-channel', data.channel);
      setField('info-phymode', data.phyMode);
      setField('info-txrate', data.txRate ? `${data.txRate} Mbps` : '—');

      // Band badge
      const bandEl = document.getElementById('info-band');
      if (bandEl && data.band) {
        bandEl.innerHTML = `<span class="band-badge ${HeatmapEngine.getBandClass(data.band)}">${data.band}</span>`;
      }

      // Signal quality color
      if (data.signal !== undefined) {
        const quality = HeatmapEngine.getSignalQuality(data.signal);
        const sigEl = document.getElementById('info-signal');
        if (sigEl) sigEl.className = quality.class;
      }

    } catch (err) {
      const statusDot = document.querySelector('#wifi-status .status-dot');
      const statusText = document.querySelector('#wifi-status .status-text');
      if (statusDot) statusDot.className = 'status-dot offline';
      if (statusText) statusText.textContent = 'Bağlantı yok';
    }
  }

  // ─── Toolbar ───────────────────────────────────────────
  function bindToolbar() {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tool = btn.dataset.tool;
        FloorPlan.setTool(tool);

        const statusToolEl = document.getElementById('status-tool');
        const toolNames = {
          'select': 'Seç', 'measure': 'Ölçüm', 'draw-rect': 'Oda',
          'draw-line': 'Duvar', 'draw-text': 'Metin', 'eraser': 'Sil',
          'room-polygon': 'Oda Belirle'
        };
        if (statusToolEl) statusToolEl.textContent = `Araç: ${toolNames[tool] || tool}`;

        // Show/hide polygon drawing floating actions
        const polyActions = document.getElementById('room-polygon-actions');
        if (polyActions) {
          if (tool === 'room-polygon') {
            polyActions.style.display = 'flex';
            // Save current pins visibility
            const pinsCheck = document.getElementById('pins-visible');
            const toggleBtn = document.getElementById('btn-polygon-toggle-pins');
            if (pinsCheck && toggleBtn) {
              originalPinsVisible = pinsCheck.checked;
              toggleBtn.textContent = originalPinsVisible ? 'Ölçümleri Gizle' : 'Ölçümleri Göster';
            }
          } else {
            polyActions.style.display = 'none';
            FloorPlan.cancelPolygon();
            
            // Restore pins visibility
            const pinsCheck = document.getElementById('pins-visible');
            if (pinsCheck && pinsCheck.checked !== originalPinsVisible) {
              pinsCheck.checked = originalPinsVisible;
              pinsCheck.dispatchEvent(new Event('change'));
            }
          }
        }
      });
    });

    // Draw options
    const colorInput = document.getElementById('draw-color');
    if (colorInput) {
      colorInput.addEventListener('input', (e) => FloorPlan.setDrawColor(e.target.value));
    }

    const widthInput = document.getElementById('draw-width');
    if (widthInput) {
      widthInput.addEventListener('input', (e) => FloorPlan.setDrawWidth(e.target.value));
    }

    // Measurement Mode Selection Hint
    const modeSelect = document.getElementById('measurement-mode');
    const modeHint = document.getElementById('mode-hint');
    if (modeSelect && modeHint) {
      modeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'smart') {
          modeHint.textContent = 'Akıllı Hibrit: Bağlı bandı ölçer, diğer bandı tarayıp hızını sinyale göre otomatik tahmin eder.';
        } else if (val === 'manual') {
          modeHint.textContent = 'Adım Adım: Önce bağlı bandı test eder, sonra diğer banda geçmenizi isteyip orayı da test eder.';
        } else {
          modeHint.textContent = 'Tek Bant: Sadece şu an bağlı olduğunuz bandı (2.4GHz veya 5GHz) test eder.';
        }
      });
    }
  }

  // ─── Floor Plan Upload ─────────────────────────────────
  function bindFloorplanUpload() {
    // Both upload triggers (sidebar + welcome)
    ['floorplan-upload', 'floorplan-upload-hero'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          try {
            await FloorPlan.loadImage(file);
            hideWelcome();
            showStatus('Kat planı yüklendi ✓');
          } catch (err) {
            showStatus('Resim yüklenemedi: ' + err.message);
          }
          e.target.value = '';
        });
      }
    });

    // Start drawing button
    const startDrawBtn = document.getElementById('btn-start-drawing');
    if (startDrawBtn) {
      startDrawBtn.addEventListener('click', () => {
        hideWelcome();
        // Switch to rectangle tool
        document.querySelector('.tool-btn[data-tool="draw-rect"]')?.click();
        showStatus('Boş canvas hazır — çizime başlayabilirsiniz');
      });
    }

    // Clear floor plan
    const clearBtn = document.getElementById('btn-clear-floorplan');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Kat planı ve çizimler silinecek. Emin misiniz?')) {
          FloorPlan.clearFloorplan();
          showWelcome();
          showStatus('Kat planı temizlendi');
        }
      });
    }

    // Drag & drop on canvas container
    const container = document.getElementById('canvas-container');
    if (container) {
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        container.style.outline = '3px dashed rgba(99, 102, 241, 0.5)';
      });

      container.addEventListener('dragleave', () => {
        container.style.outline = 'none';
      });

      container.addEventListener('drop', async (e) => {
        e.preventDefault();
        container.style.outline = 'none';

        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          try {
            await FloorPlan.loadImage(file);
            hideWelcome();
            showStatus('Kat planı yüklendi ✓');
          } catch (err) {
            showStatus('Resim yüklenemedi');
          }
        }
      });
    }
  }

  // ─── Heatmap Controls ─────────────────────────────────
  function bindHeatmapControls() {
    const layerSelect = document.getElementById('heatmap-layer');
    if (layerSelect) {
      layerSelect.addEventListener('change', (e) => HeatmapEngine.setLayer(e.target.value));
    }

    const bandSelect = document.getElementById('heatmap-band');
    if (bandSelect) {
      bandSelect.addEventListener('change', (e) => HeatmapEngine.setBandFilter(e.target.value));
    }

    const visibleCheck = document.getElementById('heatmap-visible');
    if (visibleCheck) {
      visibleCheck.addEventListener('change', (e) => HeatmapEngine.setVisible(e.target.checked));
    }

    const opacitySlider = document.getElementById('heatmap-opacity');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => HeatmapEngine.setOpacity(parseInt(e.target.value) / 100));
    }

    const pinsCheck = document.getElementById('pins-visible');
    if (pinsCheck) {
      pinsCheck.addEventListener('change', (e) => Survey.setPinsVisible(e.target.checked));
    }

    const roomsCheck = document.getElementById('rooms-visible');
    if (roomsCheck) {
      roomsCheck.addEventListener('change', (e) => FloorPlan.setRoomsVisible(e.target.checked));
    }

    const routersCheck = document.getElementById('routers-visible');
    if (routersCheck) {
      routersCheck.addEventListener('change', (e) => Survey.setRoutersVisible(e.target.checked));
    }

    // Tüm Odaları Sil butonu
    document.getElementById('btn-clear-all-rooms')?.addEventListener('click', () => {
      const shapes = FloorPlan.getDrawingData() || [];
      const roomCount = shapes.filter(s => s.type === 'draw-rect' || s.type === 'room-polygon').length;
      if (roomCount === 0) {
        showStatus('Silinecek oda bulunamadı');
        return;
      }
      if (confirm(`${roomCount} adet oda silinecek. Emin misiniz?`)) {
        FloorPlan.clearAllRooms();
        triggerAutosave();
        showStatus(`${roomCount} oda silindi`);
      }
    });
  }

  // ─── Zoom Controls ────────────────────────────────────
  function bindZoomControls() {
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => FloorPlan.zoomIn());
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => FloorPlan.zoomOut());
    document.getElementById('btn-zoom-fit')?.addEventListener('click', () => FloorPlan.zoomFit());
  }

  function handleTransformChange({ scale }) {
    const zoomEl = document.getElementById('zoom-level');
    if (zoomEl) zoomEl.textContent = `${Math.round(scale * 100)}%`;

    const statusZoom = document.getElementById('status-zoom');
    if (statusZoom) statusZoom.textContent = `Zoom: ${Math.round(scale * 100)}%`;
  }

  // ─── Canvas Click (Measurement) ───────────────────────
  async function handleCanvasClick(canvasX, canvasY, screenX, screenY) {
    const activeToolBtn = document.querySelector('.tool-btn.active');
    const tool = activeToolBtn ? activeToolBtn.getAttribute('data-tool') : 'select';

    if (tool === 'router') {
      if (!currentProjectId) {
        showStatus('Lütfen önce bir proje seçin veya oluşturun');
        return;
      }
      pendingRouterPos = { x: canvasX, y: canvasY };
      const modal = document.getElementById('modal-router-overlay');
      if (modal) {
        modal.style.display = 'flex';
        // Reset inputs
        const bandSelect = document.getElementById('router-band');
        if (bandSelect) {
          bandSelect.value = '5GHz';
          bandSelect.dispatchEvent(new Event('change'));
        }
        const nameInput = document.getElementById('router-name');
        if (nameInput) {
          nameInput.value = `Access Point ${Survey.getRouters().length + 1}`;
          nameInput.focus();
        }
      }
      return;
    }

    if (isMeasuring) return;

    await performMeasurementAt(canvasX, canvasY, (wifi, speed, bandsData) => {
      Survey.addMeasurement(canvasX, canvasY, wifi, speed, '', bandsData);
      HeatmapEngine.render();
      showStatus('Ölçüm kaydedildi ✓');
      triggerAutosave();
    });
  }

  // ─── Perform 5-second Measurement Helper ───────────────
  async function performMeasurementAt(canvasX, canvasY, onComplete) {
    if (isMeasuring) return;
    isMeasuring = true;
    measureCancelled = false;

    const modeSelect = document.getElementById('measurement-mode');
    const mode = modeSelect ? modeSelect.value : 'smart';

    showMeasuringModal();

    async function run5SecondSampling() {
      const samples = [];
      let scannedAllData = null;
      let scanAllPromise = null;

      for (let i = 1; i <= 5; i++) {
        if (measureCancelled) return null;

        updateMeasureStep('step-sample-' + i, 'active');
        updateMeasureProgress(i * 20);

        try {
          const res = await fetch(`${API_BASE}/api/wifi/scan`);
          if (res.ok) {
            const data = await res.json();
            samples.push(data);
            updateMeasureStep('step-sample-' + i, 'done');
          } else {
            updateMeasureStep('step-sample-' + i, 'error');
          }
        } catch (e) {
          updateMeasureStep('step-sample-' + i, 'error');
        }

        if (i === 3 && mode === 'smart') {
          scanAllPromise = fetch(`${API_BASE}/api/wifi/scan-all`)
            .then(res => res.ok ? res.json() : null)
            .catch(e => {
              console.error('Scan all error during sampling:', e);
              return null;
            });
        }

        if (i < 5 && !measureCancelled) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (scanAllPromise) {
        const modalTitle = document.getElementById('measuring-title');
        if (modalTitle) {
          modalTitle.textContent = 'Çift Bant Verileri Birleştiriliyor...';
        }
        scannedAllData = await scanAllPromise;
      }

      const validSamples = samples.filter(s => s && s.signal !== undefined);
      if (validSamples.length === 0) {
        throw new Error('WiFi verisi alınamadı');
      }

      const first = validSamples[0];
      const avgSignal = Math.round(validSamples.reduce((sum, s) => sum + s.signal, 0) / validSamples.length);
      const minSignal = Math.min(...validSamples.map(s => s.signal));
      const maxSignal = Math.max(...validSamples.map(s => s.signal));

      const avgSnr = Math.round(validSamples.reduce((sum, s) => sum + (s.snr || 0), 0) / validSamples.length);
      const minSnr = Math.min(...validSamples.map(s => s.snr || 0));
      const maxSnr = Math.max(...validSamples.map(s => s.snr || 0));

      const avgTxRate = Math.round(validSamples.reduce((sum, s) => sum + (s.txRate || 0), 0) / validSamples.length);
      const minTxRate = Math.min(...validSamples.map(s => s.txRate || 0));
      const maxTxRate = Math.max(...validSamples.map(s => s.txRate || 0));

      const wifiData = {
        ssid: first.ssid,
        band: first.band,
        channel: first.channel,
        phyMode: first.phyMode,
        signal: avgSignal,
        signalMin: minSignal,
        signalMax: maxSignal,
        snr: avgSnr,
        snrMin: minSnr,
        snrMax: maxSnr,
        txRate: avgTxRate,
        txRateMin: minTxRate,
        txRateMax: maxTxRate
      };

      const speedData = {
        download: avgTxRate,
        downloadMin: minTxRate,
        downloadMax: maxTxRate,
        upload: Math.round(avgTxRate * 0.4),
        uploadMin: Math.round(minTxRate * 0.4),
        uploadMax: Math.round(maxTxRate * 0.4),
        latency: 5,
        jitter: 1
      };

      return { wifi: wifiData, speed: speedData, rawScanAll: scannedAllData };
    }

    try {
      if (mode === 'current') {
        document.getElementById('measuring-title').textContent = 'Tek Bant Sinyal Analizi (5 sn)…';
        const result = await run5SecondSampling();
        if (result) {
          if (onComplete) onComplete(result.wifi, result.speed, null);
          if (result.wifi && result.wifi.signal !== undefined) {
            showLargeResultOverlay(result.wifi.signal);
          }
        }
      } 
      else if (mode === 'smart') {
        document.getElementById('measuring-title').textContent = 'Akıllı Çift Bant Analizi (5 sn)…';
        const result = await run5SecondSampling();
        if (!result) return cleanup();

        const currentBand = result.wifi ? result.wifi.band : '5GHz';
        const counterpartBand = currentBand === '5GHz' ? '2.4GHz' : '5GHz';

        const bandsData = {};
        bandsData[currentBand] = result;

        if (result.rawScanAll) {
          const networks = result.rawScanAll.networks || [];
          const currentSsid = result.wifi ? result.wifi.ssid : '';
          
          let counterpartWifi = networks.find(n => n.ssid === currentSsid && n.band === counterpartBand);
          if (!counterpartWifi && currentSsid !== 'Bağlı Ağ') {
            counterpartWifi = networks.find(n => n.band === counterpartBand && (n.ssid.includes(currentSsid) || currentSsid.includes(n.ssid)));
          }
          if (!counterpartWifi) {
            const bandNetworks = networks.filter(n => n.band === counterpartBand);
            if (bandNetworks.length > 0) {
              bandNetworks.sort((a, b) => b.signal - a.signal);
              counterpartWifi = bandNetworks[0];
            }
          }

          if (counterpartWifi) {
            const sig = counterpartWifi.signal || -70;
            const minSig = sig - Math.round(Math.random() * 2 + 1);
            const maxSig = sig + Math.round(Math.random() * 2 + 1);

            let avgTx, minTx, maxTx;
            if (counterpartBand === '2.4GHz') {
              const estimate = (s) => {
                if (s >= -55) return 144;
                if (s >= -68) return 108;
                if (s >= -78) return 54;
                return 11;
              };
              avgTx = estimate(sig);
              minTx = estimate(minSig);
              maxTx = estimate(maxSig);
            } else {
              const estimate = (s) => {
                if (s >= -55) return 866;
                if (s >= -68) return 580;
                if (s >= -78) return 260;
                return 54;
              };
              avgTx = estimate(sig);
              minTx = estimate(minSig);
              maxTx = estimate(maxSig);
            }

            bandsData[counterpartBand] = {
              wifi: {
                ssid: counterpartWifi.ssid,
                band: counterpartBand,
                channel: counterpartWifi.channel,
                phyMode: counterpartWifi.phyMode || (counterpartBand === '5GHz' ? '802.11ac' : '802.11n'),
                signal: sig,
                signalMin: minSig,
                signalMax: maxSig,
                snr: counterpartWifi.snr || (sig - (-90)),
                snrMin: (sig - (-90)) - 2,
                snrMax: (sig - (-90)) + 2,
                txRate: avgTx,
                txRateMin: minTx,
                txRateMax: maxTx
              },
              speed: {
                download: avgTx,
                downloadMin: minTx,
                downloadMax: maxTx,
                upload: Math.round(avgTx * 0.4),
                uploadMin: Math.round(minTx * 0.4),
                uploadMax: Math.round(maxTx * 0.4),
                latency: 5,
                jitter: 1
              }
            };
          }
        }

        if (onComplete) onComplete(result.wifi, result.speed, bandsData);
        if (result.wifi && result.wifi.signal !== undefined) {
          showLargeResultOverlay(result.wifi.signal);
        }
      }
      else if (mode === 'manual') {
        document.getElementById('measuring-title').textContent = '1. Bant Analizi (5 sn)…';
        const result1 = await run5SecondSampling();
        if (!result1) return cleanup();

        const band1 = result1.wifi ? result1.wifi.band : '5GHz';
        const band2 = band1 === '5GHz' ? '2.4GHz' : '5GHz';

        const bandsData = {};
        bandsData[band1] = result1;

        document.getElementById('measuring-title').textContent = 'WiFi Bandını Değiştirin';
        document.getElementById('measuring-guide-text').textContent = `1. Bant (${band1}) ölçüldü!`;
        document.getElementById('measuring-guide-container').style.display = 'block';

        document.querySelector('.measuring-steps').style.display = 'none';
        document.querySelector('.measuring-progress').style.display = 'none';

        const userChoice = await new Promise((resolve) => {
          const btnContinue = document.getElementById('btn-manual-continue');
          const btnSkip = document.getElementById('btn-manual-skip');
          const btnCancel = document.getElementById('btn-cancel-measuring');

          const cleanupListeners = () => {
            btnContinue.onclick = null;
            btnSkip.onclick = null;
            btnCancel.onclick = null;
          };

          btnContinue.onclick = () => { cleanupListeners(); resolve('continue'); };
          btnSkip.onclick = () => { cleanupListeners(); resolve('skip'); };
          btnCancel.onclick = () => { cleanupListeners(); resolve('cancel'); };
        });

        document.getElementById('measuring-guide-container').style.display = 'none';
        document.querySelector('.measuring-steps').style.display = 'block';
        document.querySelector('.measuring-progress').style.display = 'block';

        if (userChoice === 'cancel' || measureCancelled) {
          measureCancelled = true;
          return cleanup();
        }

        if (userChoice === 'skip') {
          if (onComplete) onComplete(result1.wifi, result1.speed, bandsData);
          if (result1.wifi && result1.wifi.signal !== undefined) {
            showLargeResultOverlay(result1.wifi.signal);
          }
        } else {
          document.getElementById('measuring-title').textContent = `2. Bant (${band2}) Analizi (5 sn)…`;
          for (let i = 1; i <= 5; i++) {
            updateMeasureStep('step-sample-' + i, 'pending');
          }
          updateMeasureProgress(0);

          const result2 = await run5SecondSampling();
          if (result2) {
            bandsData[result2.wifi ? result2.wifi.band : band2] = result2;
            if (onComplete) onComplete(result1.wifi, result1.speed, bandsData);
            if (result1.wifi && result1.wifi.signal !== undefined) {
              showLargeResultOverlay(result1.wifi.signal);
            }
          }
        }
      }
    } catch (err) {
      console.error('Measurement error:', err);
      showStatus('Ölçüm hatası: ' + err.message);
    } finally {
      cleanup();
    }

    function cleanup() {
      isMeasuring = false;
      hideMeasuringModal();
      document.getElementById('measuring-title').textContent = 'Ölçüm Yapılıyor…';
      document.getElementById('measuring-guide-container').style.display = 'none';
      document.querySelector('.measuring-steps').style.display = 'block';
      document.querySelector('.measuring-progress').style.display = 'block';
    }
  }

  // ─── Measuring Modal ──────────────────────────────────
  function showMeasuringModal() {
    const modal = document.getElementById('modal-measuring');
    if (modal) {
      modal.style.display = 'flex';
      // Reset steps
      for (let i = 1; i <= 5; i++) {
        updateMeasureStep('step-sample-' + i, 'pending');
      }
      updateMeasureProgress(0);
    }
  }

  function hideMeasuringModal() {
    const modal = document.getElementById('modal-measuring');
    if (modal) modal.style.display = 'none';
  }

  function updateMeasureStep(stepId, status) {
    const el = document.getElementById(stepId);
    if (!el) return;

    el.className = 'step ' + status;
    const iconEl = el.querySelector('.step-icon');
    if (iconEl) {
      switch (status) {
        case 'active': iconEl.textContent = '🔄'; break;
        case 'done': iconEl.textContent = '✅'; break;
        case 'error': iconEl.textContent = '❌'; break;
        default: iconEl.textContent = '⏳';
      }
    }
  }

  function updateMeasureProgress(pct) {
    const fill = document.getElementById('measuring-progress-fill');
    if (fill) fill.style.width = pct + '%';
  }

  // ─── Project Management ────────────────────────────────
  function bindProjectControls() {
    document.getElementById('btn-new-project')?.addEventListener('click', showNewProjectModal);
    document.getElementById('btn-save-project')?.addEventListener('click', saveCurrentProject);
    document.getElementById('btn-delete-project')?.addEventListener('click', deleteCurrentProject);

    document.getElementById('project-select')?.addEventListener('change', (e) => {
      const id = e.target.value;
      if (id) loadProject(id);
    });
  }

  async function loadProjectsList() {
    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      if (!res.ok) return;
      const projects = await res.json();

      const select = document.getElementById('project-select');
      if (!select) return;

      // Keep first option
      select.innerHTML = '<option value="">— Proje Seç —</option>';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
      });

      // Select current if exists
      if (currentProjectId) {
        select.value = currentProjectId;
      }
    } catch (err) {
      console.error('Projects load error:', err);
    }
  }

  async function loadProject(id) {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}`);
      if (!res.ok) return;
      const project = await res.json();

      currentProjectId = project.id;

      // Load floor plan
      if (project.floorplan) {
        await FloorPlan.loadImageFromDataURL(project.floorplan);
        hideWelcome();
      }

      // Load drawings
      if (project.floorplanDrawing) {
        FloorPlan.setDrawingData(project.floorplanDrawing);
      }

      // Load measurements
      if (project.measurements) {
        Survey.setMeasurements(project.measurements);
      }

      // Load routers
      if (project.routers) {
        Survey.setRouters(project.routers);
      } else {
        Survey.setRouters([]);
      }

      HeatmapEngine.render();
      showStatus(`Proje yüklendi: ${project.name}`);
    } catch (err) {
      showStatus('Proje yüklenemedi');
    }
  }

  async function saveCurrentProject() {
    if (!currentProjectId) {
      showNewProjectModal();
      return;
    }

    try {
      const data = {
        floorplan: FloorPlan.getFloorplanDataURL(),
        floorplanDrawing: FloorPlan.getDrawingData(),
        measurements: Survey.getMeasurements(),
        routers: Survey.getRouters()
      };

      const res = await fetch(`${API_BASE}/api/projects/${currentProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        showStatus('Proje kaydedildi ✓');
      } else {
        showStatus('Kaydetme hatası');
      }
    } catch (err) {
      showStatus('Kaydetme hatası: ' + err.message);
    }
  }

  let autosaveTimer = null;
  function triggerAutosave() {
    if (!currentProjectId) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);

    // Update UI status to show background saving state
    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = 'Değişiklikler kaydediliyor...';

    autosaveTimer = setTimeout(async () => {
      try {
        const data = {
          floorplan: FloorPlan.getFloorplanDataURL(),
          floorplanDrawing: FloorPlan.getDrawingData(),
          measurements: Survey.getMeasurements(),
          routers: Survey.getRouters()
        };

        const res = await fetch(`${API_BASE}/api/projects/${currentProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          showStatus('Değişiklikler otomatik kaydedildi ✓');
        } else {
          showStatus('Otomatik kaydetme başarısız');
        }
      } catch (err) {
        console.error('Autosave error:', err);
        showStatus('Otomatik kaydetme hatası: ' + err.message);
      }
    }, 1500); // 1.5 second debounce
  }

  async function deleteCurrentProject() {
    if (!currentProjectId) return;
    if (!confirm('Bu projeyi silmek istediğinize emin misiniz?')) return;

    try {
      await fetch(`${API_BASE}/api/projects/${currentProjectId}`, { method: 'DELETE' });
      currentProjectId = null;
      FloorPlan.clearFloorplan();
      Survey.setMeasurements([]);
      Survey.setRouters([]);
      HeatmapEngine.render();
      showWelcome();
      await loadProjectsList();
      showStatus('Proje silindi');
    } catch (err) {
      showStatus('Silme hatası');
    }
  }

  // ─── Modal Controls ───────────────────────────────────
  function bindModalControls() {
    // New Project Modal
    document.getElementById('btn-modal-cancel')?.addEventListener('click', hideModals);
    document.getElementById('btn-modal-create')?.addEventListener('click', createNewProject);

    // Cancel measuring
    document.getElementById('btn-cancel-measuring')?.addEventListener('click', () => {
      measureCancelled = true;
      isMeasuring = false;
      hideMeasuringModal();
      showStatus('Ölçüm iptal edildi');
    });

    // Text input modal
    document.getElementById('btn-text-cancel')?.addEventListener('click', () => {
      document.getElementById('modal-text-input').style.display = 'none';
      pendingTextPos = null;
    });

    document.getElementById('btn-text-add')?.addEventListener('click', () => {
      const input = document.getElementById('canvas-text-input');
      if (input && pendingTextPos) {
        FloorPlan.addTextShape(pendingTextPos.x, pendingTextPos.y, input.value);
        input.value = '';
        document.getElementById('modal-text-input').style.display = 'none';
        pendingTextPos = null;
      }
    });

    // Enter key in text input
    document.getElementById('canvas-text-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-text-add')?.click();
      }
    });

    // Enter key in project name
    document.getElementById('new-project-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-modal-create')?.click();
      }
    });

    // Close modal on overlay click
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') hideModals();
    });
  }

  function showNewProjectModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) {
      modal.style.display = 'flex';
      document.getElementById('new-project-name').value = '';
      document.getElementById('new-project-name').focus();
    }
  }

  function hideModals() {
    document.getElementById('modal-overlay').style.display = 'none';
  }

  async function createNewProject() {
    const nameInput = document.getElementById('new-project-name');
    const name = nameInput?.value.trim() || 'Yeni Proje';

    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          floorplan: FloorPlan.getFloorplanDataURL(),
          floorplanDrawing: FloorPlan.getDrawingData(),
          measurements: Survey.getMeasurements(),
          routers: Survey.getRouters()
        })
      });

      if (res.ok) {
        const project = await res.json();
        currentProjectId = project.id;
        await loadProjectsList();
        document.getElementById('project-select').value = project.id;
        hideModals();
        showStatus(`Proje oluşturuldu: ${name}`);
      }
    } catch (err) {
      showStatus('Proje oluşturma hatası');
    }
  }

  // ─── Export Controls ───────────────────────────────────
  function bindExportControls() {
    document.getElementById('btn-export-png')?.addEventListener('click', () => ExportModule.exportPNG());
    document.getElementById('btn-export-json')?.addEventListener('click', () => ExportModule.exportJSON());
    document.getElementById('btn-export-csv')?.addEventListener('click', () => ExportModule.exportCSV());
    document.getElementById('btn-export-report')?.addEventListener('click', () => ExportModule.exportReport());
  }

  // ─── Measurement Controls ─────────────────────────────
  function bindMeasurementControls() {
    // Delete button
    document.getElementById('btn-delete-measurement')?.addEventListener('click', () => {
      const id = Survey.getSelectedId();
      if (id) {
        Survey.removeMeasurement(id);
        HeatmapEngine.render();
        showStatus('Ölçüm silindi');
        triggerAutosave();
      }
    });

    // Re-measure button
    document.getElementById('btn-remeasure')?.addEventListener('click', async () => {
      const id = Survey.getSelectedId();
      if (!id || id.startsWith('router_')) return;
      const m = Survey.getMeasurements().find(x => x.id === id);
      if (!m) return;

      const overwrite = confirm("Eski ölçüm verisi silinsin ve üzerine mi yazılsın?\n\n[Tamam] = Eski Veriyi Sil ve Üzerine Yaz\n[İptal] = Eski Veriyi Koru (Yeni Ölçüm Ekle)");

      await performMeasurementAt(m.x, m.y, (wifi, speed, bandsData) => {
        if (overwrite) {
          m.wifi = wifi;
          m.speed = speed;
          m.bands = bandsData;
          m.timestamp = new Date().toISOString();
          Survey.selectMeasurement(m.id);
          showStatus('Ölçüm verisi güncellendi ✓');
        } else {
          Survey.addMeasurement(m.x, m.y, wifi, speed, `${m.label} (Yeni)`, bandsData);
          showStatus('Yeni ölçüm eklendi, eski veri korundu ✓');
        }
        HeatmapEngine.render();
        triggerAutosave();
      });
    });

    // Label edit
    document.getElementById('measurement-label')?.addEventListener('change', (e) => {
      const id = Survey.getSelectedId();
      if (id) {
        Survey.updateLabel(id, e.target.value);
        Survey.renderPins();
        triggerAutosave();
      }
    });

    // Oda ismi anlık güncelleme
    document.getElementById('measurement-label')?.addEventListener('input', (e) => {
      const id = Survey.getSelectedId();
      if (id && id.startsWith('shape_')) {
        FloorPlan.updateShapeLabel(id, e.target.value);
      }
    });
  }

  // ─── Text Input Modal (for drawing) ───────────────────
  function showTextInputModal(x, y) {
    pendingTextPos = { x, y };
    const modal = document.getElementById('modal-text-input');
    if (modal) {
      modal.style.display = 'flex';
      const input = document.getElementById('canvas-text-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  // ─── Room Context Menu (Çift Tıklama) ─────────────────
  function handleShapeDoubleClick(shapeId, screenX, screenY) {
    showRoomContextMenu(shapeId, screenX, screenY);
  }

  function showRoomContextMenu(shapeId, screenX, screenY) {
    closeRoomContextMenu();

    const shapes = FloorPlan.getDrawingData();
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;

    const menu = document.createElement('div');
    menu.id = 'room-context-menu';
    menu.style.cssText = `
      position: fixed; left: ${screenX}px; top: ${screenY}px; z-index: 10000;
      background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99,102,241,0.35);
      border-radius: 10px; padding: 6px 0; min-width: 200px;
      box-shadow: 0 12px 35px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      opacity: 0; transform: scale(0.95); transition: opacity 0.12s, transform 0.12s;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 16px 6px; font-size: 0.72rem; color: rgba(255,255,255,0.4);
      text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
      border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 4px;
    `;
    header.textContent = shape.text || 'Oda';
    menu.appendChild(header);

    const menuItems = [
      { icon: '✏️', text: 'İsmi Değiştir', action: 'rename' },
      { icon: '🗑️', text: 'Odayı Sil', action: 'delete', danger: true }
    ];

    menuItems.forEach(item => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 16px;
        background: transparent; border: none; font-size: 0.85rem;
        cursor: pointer; text-align: left; font-family: Inter, sans-serif;
        color: ${item.danger ? '#f87171' : '#e2e8f0'}; transition: background 0.1s;
      `;
      btn.innerHTML = `<span style="font-size: 1rem;">${item.icon}</span> ${item.text}`;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = item.danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99,102,241,0.15)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
      btn.addEventListener('click', () => {
        closeRoomContextMenu();
        if (item.action === 'rename') {
          const newName = prompt('Oda İsmini Girin:', shape.text || '');
          if (newName !== null) {
            FloorPlan.updateShapeLabel(shapeId, newName.trim() || shape.text);
            Survey.selectMeasurement(shapeId);
            triggerAutosave();
            showStatus('Oda ismi güncellendi: ' + (newName.trim() || shape.text));
          }
        } else if (item.action === 'delete') {
          if (confirm('"' + (shape.text || 'Bu oda') + '" silinsin mi?')) {
            Survey.removeMeasurement(shapeId);
            triggerAutosave();
            showStatus('Oda silindi');
          }
        }
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // Animasyonlu açılma
    requestAnimationFrame(() => {
      menu.style.opacity = '1';
      menu.style.transform = 'scale(1)';
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
      }
    });

    setTimeout(() => {
      document.addEventListener('click', closeRoomContextMenuOutside);
    }, 50);
  }

  function closeRoomContextMenu() {
    const menu = document.getElementById('room-context-menu');
    if (menu) menu.remove();
    document.removeEventListener('click', closeRoomContextMenuOutside);
  }

  function closeRoomContextMenuOutside(e) {
    const menu = document.getElementById('room-context-menu');
    if (menu && !menu.contains(e.target)) {
      closeRoomContextMenu();
    }
  }

  // ─── UI Helpers ────────────────────────────────────────
  function hideWelcome() {
    const el = document.getElementById('welcome-overlay');
    if (el) el.style.display = 'none';
  }

  function showWelcome() {
    const el = document.getElementById('welcome-overlay');
    if (el) el.style.display = 'flex';
  }

  function showStatus(msg) {
    const el = document.getElementById('status-message');
    if (el) {
      el.textContent = msg;
      setTimeout(() => { el.textContent = ''; }, 4000);
    }
  }

  function setField(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  }

  // ─── Router Controls ──────────────────────────────────
  function bindRouterControls() {
    // Cancel Router Placement Modal
    document.getElementById('btn-router-cancel')?.addEventListener('click', () => {
      document.getElementById('modal-router-overlay').style.display = 'none';
      pendingRouterPos = null;
    });

    // Band selection change toggle
    const bandSelect = document.getElementById('router-band');
    if (bandSelect) {
      bandSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const singleGroup = document.getElementById('router-single-channel-group');
        const dualGroup = document.getElementById('router-dual-channels-group');
        if (val === '5GHz+2.4GHz') {
          if (singleGroup) singleGroup.style.display = 'none';
          if (dualGroup) dualGroup.style.display = 'flex';
        } else {
          if (singleGroup) singleGroup.style.display = 'block';
          if (dualGroup) dualGroup.style.display = 'none';
        }
      });
    }

    // Add Router button click
    document.getElementById('btn-router-add')?.addEventListener('click', () => {
      const nameInput = document.getElementById('router-name');
      const bandSelect = document.getElementById('router-band');
      const channelInput = document.getElementById('router-channel');
      const channel5Input = document.getElementById('router-channel-5');
      const channel24Input = document.getElementById('router-channel-24');

      if (pendingRouterPos && nameInput && bandSelect && channelInput) {
        const name = nameInput.value.trim() || 'Access Point';
        const band = bandSelect.value;
        
        let channel, channel24;
        if (band === '5GHz+2.4GHz') {
          channel = parseInt(channel5Input.value) || 36;
          channel24 = parseInt(channel24Input.value) || 6;
        } else {
          channel = parseInt(channelInput.value) || 36;
          channel24 = null;
        }

        const isMesh = document.getElementById('router-mesh')?.checked || false;
        Survey.addRouter(pendingRouterPos.x, pendingRouterPos.y, name, band, channel, channel24, isMesh);
        triggerAutosave();

        nameInput.value = '';
        const meshCheckbox = document.getElementById('router-mesh');
        if (meshCheckbox) meshCheckbox.checked = false;
        document.getElementById('modal-router-overlay').style.display = 'none';
        pendingRouterPos = null;
      }
    });

    // Enter key support in router modal name field
    document.getElementById('router-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-router-add')?.click();
      }
    });
    document.getElementById('router-channel')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-router-add')?.click();
      }
    });
    document.getElementById('router-channel-5')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-router-add')?.click();
      }
    });
    document.getElementById('router-channel-24')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-router-add')?.click();
      }
    });
  }

  // ─── AI Controls ──────────────────────────────────────
  function bindAiControls() {
    // Trigger Analysis button click
    document.getElementById('btn-ai-analysis')?.addEventListener('click', () => {
      runAiNetworkAnalysis();
      document.getElementById('modal-ai-overlay').style.display = 'flex';
    });

    // Close Analysis modal (header x)
    document.getElementById('btn-close-ai')?.addEventListener('click', () => {
      document.getElementById('modal-ai-overlay').style.display = 'none';
    });

    // Close Analysis modal (ok button)
    document.getElementById('btn-ok-ai')?.addEventListener('click', () => {
      document.getElementById('modal-ai-overlay').style.display = 'none';
    });

    // Print Analysis modal
    document.getElementById('btn-print-ai')?.addEventListener('click', () => {
      const content = document.getElementById('ai-analysis-content').innerHTML;
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
          <head>
            <title>Yapay Zeka Ağ Analiz Raporu - WifiMapper</title>
            <style>
              body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; background: #ffffff; }
              h3 { font-size: 1.5rem; border-bottom: 2px solid #6366f1; padding-bottom: 8px; margin-bottom: 20px; }
              h4 { font-size: 1.1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 25px; }
              ul { padding-left: 20px; }
              li { margin-bottom: 8px; }
              .info-row { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px; }
              div[style*="background"] { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; color: #1e293b !important; }
              div[style*="color: #fbbf24"] { color: #d97706 !important; }
              div[style*="color: #ef4444"] { color: #dc2626 !important; }
              div[style*="color: #a855f7"] { color: #7c3aed !important; }
              div[style*="color: #6366f1"] { color: #4f46e5 !important; }
              span[style*="color: #fbbf24"] { color: #d97706 !important; }
              span[style*="color: #ef4444"] { color: #dc2626 !important; }
              span[style*="color: #34d399"] { color: #16a34a !important; }
              span[style*="color: #10b981"] { color: #16a34a !important; }
            </style>
          </head>
          <body>
            <h3>🧠 Yapay Zeka Ağ Analiz Raporu</h3>
            ${content}
            <script>window.print();</script>
          </body>
        </html>
      `);
      win.document.close();
    });
  }

  // ─── AI Network Analysis Algorithm ────────────────────
  function runAiNetworkAnalysis() {
    const measurements = Survey.getMeasurements() || [];
    const routers = Survey.getRouters() || [];
    const contentEl = document.getElementById('ai-analysis-content');
    if (!contentEl) return;

    if (routers.length === 0) {
      contentEl.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #f87171; background: rgba(239, 68, 68, 0.05); border: 1px dashed rgba(239, 68, 68, 0.2); border-radius: 8px;">
          <h4 style="margin: 0 0 8px 0; font-size: 1rem; font-weight: 600;">⚠️ Modem/AP Bulunamadı</h4>
          <p style="margin: 0; font-size: 0.85rem; font-weight: 300;">Yapay zeka analizi yapabilmek için lütfen önce sol menüdeki <strong>"Modem/AP"</strong> aracını seçip kat planınızda cihazlarınızın yerini işaretleyin.</p>
        </div>
      `;
      return;
    }

    let reportHtml = '';
    const issues = [];
    const recommendations = [];

    // --- 1. OVERVIEW STATISTICS ---
    const totalMeas = measurements.length;
    const totalRouters = routers.length;
    const signals = measurements.map(m => m.wifi ? m.wifi.signal : null).filter(s => s !== null);
    const avgSignal = signals.length > 0 ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length) : -80;

    let overallRating = 'Zayıf';
    let ratingColor = '#ef4444';
    if (avgSignal >= -60 && totalMeas >= 3) {
      overallRating = 'Mükemmel';
      ratingColor = '#10b981';
    } else if (avgSignal >= -68 && totalMeas >= 2) {
      overallRating = 'İyi';
      ratingColor = '#06b6d4';
    } else if (avgSignal >= -75) {
      overallRating = 'Orta';
      ratingColor = '#fbbf24';
    }

    reportHtml += `
      <div style="display: flex; gap: 15px; margin-bottom: 20px;">
        <div style="flex: 1; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Cihaz Sayısı</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #a855f7;">${totalRouters} AP</div>
        </div>
        <div style="flex: 1; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Ölçüm Noktası</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #6366f1;">${totalMeas} Nokta</div>
        </div>
        <div style="flex: 1; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Genel Durum</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: ${ratingColor};">${overallRating}</div>
        </div>
      </div>
    `;

    // --- MESH SISTEM BILGISI ---
    const hasMesh = routers.some(r => r.isMesh);
    if (hasMesh) {
      const meshCount = routers.filter(r => r.isMesh).length;
      reportHtml += `
        <div style="padding: 10px 14px; background: rgba(139, 92, 246, 0.06); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 6px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: rgba(255,255,255,0.7);">
          <span style="font-size: 1.1rem;">🔗</span>
          <span><strong>${meshCount}</strong> cihaz <strong>Mesh Sistem</strong> olarak işaretlenmiş. Aynı kanal ve SSID kullanımı Mesh ağlar için normaldir, bu cihazlar arası çakışma uyarıları devre dışı bırakıldı.</span>
        </div>
      `;
    }

    // --- ODA BAZLI ANALIZ ---
    const drawingShapes = FloorPlan.getDrawingData() || [];
    const rooms = drawingShapes.filter(s => s.type === 'draw-rect' || s.type === 'room-polygon');

    if (rooms.length > 0) {
      reportHtml += `<h4 style="margin: 0 0 12px 0; color: #f3e8ff; font-size: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">🏠 Oda Bazlı WiFi Durumu</h4>`;
      reportHtml += `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">`;

      const isPointInPoly = (p, polygon) => {
        let isInside = false;
        let i = 0, j = polygon.length - 1;
        for (i = 0; i < polygon.length; j = i++) {
          if ((polygon[i].y > p.y) !== (polygon[j].y > p.y) &&
              (p.x < (polygon[j].x - polygon[i].x) * (p.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
            isInside = !isInside;
          }
        }
        return isInside;
      };

      rooms.forEach(room => {
        const roomMeasurements = measurements.filter(m => {
          if (room.type === 'draw-rect') {
            const xMin = Math.min(room.x1, room.x2);
            const xMax = Math.max(room.x1, room.x2);
            const yMin = Math.min(room.y1, room.y2);
            const yMax = Math.max(room.y1, room.y2);
            return m.x >= xMin && m.x <= xMax && m.y >= yMin && m.y <= yMax;
          } else if (room.type === 'room-polygon' && room.vertices) {
            return isPointInPoly({x: m.x, y: m.y}, room.vertices);
          }
          return false;
        });

        const count = roomMeasurements.length;
        const roomSignals = roomMeasurements.map(m => m.wifi ? m.wifi.signal : null).filter(s => s !== null);
        const avgSig = roomSignals.length > 0 ? Math.round(roomSignals.reduce((a, b) => a + b, 0) / roomSignals.length) : null;

        let statusText, statusColor, statusIcon;
        if (count === 0) {
          statusText = 'Ölçüm Yok'; statusColor = '#94a3b8'; statusIcon = '⚪';
        } else if (avgSig >= -60) {
          statusText = 'Mükemmel'; statusColor = '#10b981'; statusIcon = '🟢';
        } else if (avgSig >= -68) {
          statusText = 'İyi'; statusColor = '#06b6d4'; statusIcon = '🔵';
        } else if (avgSig >= -75) {
          statusText = 'Orta'; statusColor = '#fbbf24'; statusIcon = '🟡';
        } else {
          statusText = 'Zayıf'; statusColor = '#ef4444'; statusIcon = '🔴';
        }

        reportHtml += `
          <div style="flex: 1; min-width: 140px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.78rem; color: rgba(255,255,255,0.5); margin-bottom: 2px;">${room.text || 'İsimsiz Oda'}</div>
            <div style="font-size: 1.1rem; font-weight: 700; color: ${statusColor}; margin-bottom: 4px;">${statusIcon} ${statusText}</div>
            <div style="font-size: 0.7rem; color: rgba(255,255,255,0.4);">${count} ölçüm${avgSig !== null ? ' · Ort: ' + avgSig + ' dBm' : ''}</div>
          </div>
        `;

        if (count === 0) {
          issues.push({
            severity: 'warning',
            title: `${room.text || 'İsimsiz Oda'}: Ölçüm Yapılmadı`,
            desc: `<strong>${room.text || 'İsimsiz Oda'}</strong> odasında henüz hiçbir WiFi ölçümü yapılmamış. Bu odadaki kapsama durumu bilinmiyor.`,
            rec: `Bu odanın içine birkaç farklı noktadan ölçüm yaparak kapsama kalitesini belirleyin.`
          });
        } else if (avgSig < -72) {
          issues.push({
            severity: 'warning',
            title: `${room.text || 'İsimsiz Oda'}: Zayıf WiFi Sinyali`,
            desc: `<strong>${room.text || 'İsimsiz Oda'}</strong> odasında ortalama sinyal güçü <strong>${avgSig} dBm</strong> seviyesinde ölçüldü. Bu seviye stabil bir bağlantı için yetersiz kalabilir.`,
            rec: `Modem/AP cihazını bu odaya daha yakın konumlandırın veya bir WiFi genişletici (Mesh/Extender) yerleştirin.`
          });
        }
      });

      reportHtml += `</div>`;
    } else {
      reportHtml += `
        <div style="padding: 12px; background: rgba(99, 102, 241, 0.05); border: 1px dashed rgba(99,102,241,0.2); border-radius: 6px; margin-bottom: 20px; text-align: center; font-size: 0.82rem; color: rgba(255,255,255,0.5);">
          💡 <strong>İpucu:</strong> Sol araçlardan "Dikdörtgen Çiz" veya "Köşeleri Belirle" ile odalarınızı çizerek oda bazlı analiz yapabilirsiniz.
        </div>
      `;
    }

    // --- 2. INTERFERENCE / CHANNEL OVERLAP DETECTION ---
    const logical24 = [];
    const logical5 = [];

    routers.forEach(r => {
      if (r.band === '2.4GHz') {
        logical24.push({ name: r.name, channel: r.channel, isMesh: r.isMesh });
      } else if (r.band === '5GHz') {
        logical5.push({ name: r.name, channel: r.channel, isMesh: r.isMesh });
      } else if (r.band === '5GHz+2.4GHz') {
        logical5.push({ name: r.name + ' (5 GHz)', channel: r.channel, isMesh: r.isMesh });
        logical24.push({ name: r.name + ' (2.4 GHz)', channel: r.channel24 || 6, isMesh: r.isMesh });
      }
    });

    // 2.4 GHz overlap
    for (let i = 0; i < logical24.length; i++) {
      for (let j = i + 1; j < logical24.length; j++) {
        const r1 = logical24[i];
        const r2 = logical24[j];
        const diff = Math.abs(r1.channel - r2.channel);
        if (r1.isMesh && r2.isMesh) continue; // Mesh cihazlar aynı kanalı paylaşır
        if (diff < 5) {
          issues.push({
            severity: 'critical',
            title: `Kanal Çakışması (2.4 GHz): ${r1.name} & ${r2.name}`,
            desc: `<strong>${r1.name}</strong> (Kanal ${r1.channel}) ve <strong>${r2.name}</strong> (Kanal ${r2.channel}) cihazları birbirine çok yakın frekansta çalışıyor. 2.4 GHz bandında frekansların çakışmaması için kanal farkının en az 5 olması gerekir.`,
            rec: `Kanal çakışmasını engellemek için cihazları 2.4 GHz bandında çakışmasız kanallara sabitleyin: <strong>1, 6 veya 11</strong>.`
          });
        }
      }
    }

    // 5 GHz co-channel
    for (let i = 0; i < logical5.length; i++) {
      for (let j = i + 1; j < logical5.length; j++) {
        const r1 = logical5[i];
        const r2 = logical5[j];
        if (r1.isMesh && r2.isMesh) continue; // Mesh cihazlar aynı kanalı paylaşır
        if (r1.channel === r2.channel) {
          issues.push({
            severity: 'warning',
            title: `Aynı Kanal Kullanımı (5 GHz): ${r1.name} & ${r2.name}`,
            desc: `Her iki cihaz da <strong>Kanal ${r1.channel}</strong> üzerinde çalışıyor. 5 GHz bandında bol miktarda boş kanal mevcuttur. Aynı kanalı kullanmak hava süresi (airtime) çakışmalarına neden olur.`,
            rec: `Cihazlardan birinin kanalını diğerinden farklı olacak şekilde değiştirin (Örn: biri 36, diğeri 44 veya 149).`
          });
        }
      }
    }

    // --- 3. COVERAGE / DEAD ZONE DETECTION ---
    const poorSignalPoints = measurements.filter(m => m.wifi && m.wifi.signal < -72);
    if (poorSignalPoints.length > 0) {
      const pointNames = poorSignalPoints.map(p => p.label).join(', ');
      issues.push({
        severity: 'warning',
        title: `Kapsama Alanı Sınırları ve Ölü Noktalar`,
        desc: `Kat planındaki <strong>${pointNames}</strong> ölçüm noktalarında WiFi sinyal gücü çok düşük seviyede (<strong>-72 dBm'den daha zayıf</strong>) ölçüldü. Bu alanlarda bağlantı kopmaları ve yüksek paket kayıpları yaşanabilir.`,
        rec: `Modem veya Access Point cihazınızı ölü noktalara daha yakın bir konuma kaydırın veya araya bir <strong>WiFi Extender / Mesh AP</strong> ekleyin.`
      });
    }

    // --- 4. SPEED / INTERFERENCE BOTTLENECK DETECTION ---
    const bottleneckPoints = measurements.filter(m => m.wifi && m.wifi.signal >= -62 && m.wifi.txRate < 100);
    if (bottleneckPoints.length > 0) {
      const pointNames = bottleneckPoints.map(p => p.label).join(', ');
      issues.push({
        severity: 'info',
        title: `Sinyal Güçlü Fakat Bağlantı Hızı Düşük`,
        desc: `Kat planındaki <strong>${pointNames}</strong> noktalarında sinyal kalitesi oldukça iyi olmasına rağmen kablosuz bağlantı hızı (TX Rate) beklenenden düşük (<strong>100 Mbps altı</strong>). Bu durum çevre ağlardan gelen yoğun parazitleri veya eski nesil bir protokol kullanımını (Örn: 802.11g/n) gösterir.`,
        rec: `Router ayarlarından <strong>802.11ac (Wi-Fi 5)</strong> veya <strong>802.11ax (Wi-Fi 6)</strong> modunun aktif olduğundan emin olun ve 5 GHz genişliğini en az 40MHz veya 80MHz olarak yapılandırın.`
      });
    }

    // Add default recommendations
    recommendations.push("Modeminizi yer seviyesine veya dolap içlerine koymak yerine, yerden 1-1.5 metre yüksekte ve önü açık olacak şekilde konumlandırın.");
    recommendations.push("Betonarme duvarlar ve metal eşyalar WiFi sinyallerini ciddi oranda engeller. AP yerleşimlerini bu engelleri minimize edecek koridor vb. açık alanlara yapın.");
    if (logical24.length > 0 && logical5.length === 0) {
      recommendations.push("Ağınızda 5 GHz bandının aktif olduğundan emin olun. 5 GHz çok daha yüksek hızlar sunar ve parazitlerden etkilenmez.");
    }

    // --- 5. RENDER ISSUES ---
    reportHtml += `<h4 style="margin: 0 0 10px 0; color: #f3e8ff; font-size: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">⚠️ Tespit Edilen Sorunlar</h4>`;
    if (issues.length === 0) {
      reportHtml += `
        <div style="padding: 12px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; margin-bottom: 20px; font-weight: 300; display: flex; align-items: center; gap: 8px;">
          <span style="color: #10b981; font-size: 1.2rem;">✓</span>
          <span>Tebrikler! Yapay zeka analizine göre ağınızda kritik bir kapsama boşluğu veya kanal çakışması tespit edilmedi.</span>
        </div>
      `;
    } else {
      issues.forEach(issue => {
        let borderStyle = '1px solid rgba(251, 191, 36, 0.3)';
        let bgStyle = 'rgba(251, 191, 36, 0.05)';
        let icon = '⚠️';
        let severityColor = '#fbbf24';
        
        if (issue.severity === 'critical') {
          borderStyle = '1px solid rgba(239, 68, 68, 0.3)';
          bgStyle = 'rgba(239, 68, 68, 0.05)';
          icon = '🚨';
          severityColor = '#ef4444';
        } else if (issue.severity === 'info') {
          borderStyle = '1px solid rgba(99, 102, 241, 0.3)';
          bgStyle = 'rgba(99, 102, 241, 0.05)';
          icon = 'ℹ️';
          severityColor = '#818cf8';
        }

        reportHtml += `
          <div style="border: ${borderStyle}; background: ${bgStyle}; padding: 12px; border-radius: 6px; margin-bottom: 12px; text-align: left;">
            <div style="font-weight: 700; color: ${severityColor}; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 0.9rem;">
              <span>${icon}</span> ${issue.title}
            </div>
            <div style="font-size: 0.82rem; color: rgba(255,255,255,0.8); margin-bottom: 8px; line-height: 1.45;">
              ${issue.desc}
            </div>
            <div style="font-size: 0.8rem; color: #a5b4fc; background: rgba(99, 102, 241, 0.08); padding: 8px; border-radius: 4px; border-left: 3px solid #6366f1; line-height: 1.4;">
              <strong>Öneri:</strong> ${issue.rec}
            </div>
          </div>
        `;
      });
    }

    // --- 6. RENDER RECOMMENDATIONS ---
    reportHtml += `<h4 style="margin: 20px 0 10px 0; color: #f3e8ff; font-size: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">💡 Yapay Zeka Çözüm ve Optimizasyon Önerileri</h4>`;
    reportHtml += `<ul style="margin: 0; padding-left: 20px; font-size: 0.82rem; color: rgba(255,255,255,0.8); line-height: 1.6; font-weight: 300;">`;
    recommendations.forEach(rec => {
      reportHtml += `<li style="margin-bottom: 8px;">${rec}</li>`;
    });
    reportHtml += `</ul>`;

    // Write to DOM
    contentEl.innerHTML = reportHtml;
  }

  // ─── Room Polygon Controls ───────────────────────────
  function bindRoomPolygonControls() {
    document.getElementById('btn-polygon-complete')?.addEventListener('click', () => {
      FloorPlan.completePolygon();
    });

    document.getElementById('btn-polygon-cancel')?.addEventListener('click', () => {
      FloorPlan.cancelPolygon();
      document.querySelector('.tool-btn[data-tool="select"]')?.click();
    });

    document.getElementById('btn-polygon-toggle-pins')?.addEventListener('click', (e) => {
      const pinsCheck = document.getElementById('pins-visible');
      if (pinsCheck) {
        const isVisible = pinsCheck.checked;
        pinsCheck.checked = !isVisible;
        pinsCheck.dispatchEvent(new Event('change'));
        e.target.textContent = !isVisible ? 'Ölçümleri Göster' : 'Ölçümleri Gizle';
      }
    });
  }

  // ─── Large Result Overlay Indicator ────────────────────
  function showLargeResultOverlay(signal) {
    const overlay = document.getElementById('measurement-result-overlay');
    const valEl = document.getElementById('result-overlay-value');
    const tickEl = document.getElementById('result-overlay-tick');
    const descEl = document.getElementById('result-overlay-desc');

    if (!overlay || !valEl || !tickEl || !descEl) return;

    valEl.textContent = `${signal} dBm`;
    
    let pct = 0;
    if (signal >= -30) pct = 100;
    else if (signal <= -90) pct = 0;
    else pct = Math.round(((signal - (-90)) / 60) * 100);

    tickEl.style.left = `${pct}%`;

    const quality = HeatmapEngine.getSignalQuality(signal);
    descEl.textContent = quality.label;
    
    let valColor = '#ffffff';
    switch (quality.class) {
      case 'signal-excellent': valColor = '#06b6d4'; break;
      case 'signal-good': valColor = '#10b981'; break;
      case 'signal-fair': valColor = '#fbbf24'; break;
      case 'signal-poor': valColor = '#f97316'; break;
      case 'signal-bad': valColor = '#ef4444'; break;
    }
    valEl.style.color = valColor;

    overlay.style.display = 'block';
    // Force reflow
    overlay.offsetHeight;
    overlay.style.opacity = '1';

    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.style.opacity === '0') {
          overlay.style.display = 'none';
        }
      }, 500);
    }, 2000);
  }

  // ─── Device Detection & Badge ─────────────────────────
  function setupDeviceBadge() {
    const badge = document.getElementById('device-badge');
    if (!badge) return;

    const ua = navigator.userAgent;
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);

    let deviceIcon, deviceText;
    if (isMobile && !isTablet) {
      deviceIcon = '📱';
      deviceText = 'Mobil';
      badge.className = 'device-badge mobile';
    } else if (isTablet) {
      deviceIcon = '📱';
      deviceText = 'Tablet';
      badge.className = 'device-badge mobile';
    } else {
      deviceIcon = '💻';
      deviceText = 'Desktop';
      badge.className = 'device-badge desktop';
    }

    badge.innerHTML = `${deviceIcon} ${deviceText}`;
  }

  // ─── Mobile Controls ──────────────────────────────────
  function bindMobileControls() {
    const isMobileView = () => window.innerWidth <= 768;
    if (!isMobileView()) return;

    const toolbar = document.getElementById('toolbar');
    const details = document.getElementById('details-panel');
    const backdrop = document.getElementById('mobile-backdrop');

    function closePanels() {
      toolbar?.classList.remove('mobile-open');
      details?.classList.remove('mobile-open');
      backdrop?.classList.remove('active');
    }

    // Backdrop click closes panels
    backdrop?.addEventListener('click', closePanels);

    // FAB: Tools
    document.getElementById('fab-tools')?.addEventListener('click', () => {
      const isOpen = toolbar?.classList.contains('mobile-open');
      closePanels();
      if (!isOpen) {
        toolbar?.classList.add('mobile-open');
        backdrop?.classList.add('active');
      }
    });

    // FAB: Measure
    document.getElementById('fab-measure')?.addEventListener('click', () => {
      closePanels();
      // Activate measure tool
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      const measureBtn = document.querySelector('.tool-btn[data-tool="measure"]');
      if (measureBtn) {
        measureBtn.classList.add('active');
        FloorPlan.setTool('measure');
        showStatus('Ölçüm modu: Haritaya tıklayarak ölçüm noktası ekleyin');
      }
    });

    // FAB: Zoom
    document.getElementById('fab-zoom-in')?.addEventListener('click', () => FloorPlan.zoomIn());
    document.getElementById('fab-zoom-out')?.addEventListener('click', () => FloorPlan.zoomOut());

    // FAB: Details
    document.getElementById('fab-details')?.addEventListener('click', () => {
      const isOpen = details?.classList.contains('mobile-open');
      closePanels();
      if (!isOpen) {
        details?.classList.add('mobile-open');
        backdrop?.classList.add('active');
      }
    });

    // Also handle window resize
    window.addEventListener('resize', () => {
      if (!isMobileView()) {
        closePanels();
      }
    });
  }

  // ─── Public API ────────────────────────────────────────
  return {
    boot,
    showTextInputModal
  };
})();

// ─── Start Application ──────────────────────────────────
document.addEventListener('DOMContentLoaded', App.boot);
