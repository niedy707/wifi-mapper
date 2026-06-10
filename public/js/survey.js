/**
 * Survey Module
 * Manages measurement points: add, select, delete, render pins, tooltip
 */
const Survey = (() => {
  let measurements = [];
  let routers = [];
  let selectedId = null;
  let hoveredId = null;
  let canvas, ctx;
  let pinsVisible = false;
  let routersVisible = true;

  const PIN_RADIUS = 8;
  const PIN_HIT_RADIUS = 14;

  // ─── Initialization ────────────────────────────────────
  function init() {
    canvas = document.getElementById('canvas-pins');
    ctx = canvas.getContext('2d');
  }

  // ─── Add Measurement ───────────────────────────────────
  function addMeasurement(x, y, wifiData, speedData, label = '', bandsData = null) {
    const id = 'meas_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    // Ensure bands structure is initialized
    let bands = bandsData;
    if (!bands) {
      bands = {};
      if (wifiData && wifiData.band) {
        bands[wifiData.band] = { wifi: wifiData, speed: speedData };
      }
    }

    const measurement = {
      id,
      x: Math.round(x),
      y: Math.round(y),
      timestamp: new Date().toISOString(),
      label: label || `${measurements.length + 1}`,
      wifi: wifiData || null,
      speed: speedData || null,
      bands: bands
    };

    measurements.push(measurement);
    selectedId = id;

    renderPins();
    updateUI();

    return measurement;
  }

  // ─── Add Router / AP ───────────────────────────────────
  function addRouter(x, y, name, band, channel, channel24, isMesh) {
    const id = 'router_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const router = {
      id,
      x: Math.round(x),
      y: Math.round(y),
      name: name || `Cihaz ${routers.length + 1}`,
      band: band || '5GHz',
      channel: parseInt(channel) || 36,
      channel24: band === '5GHz+2.4GHz' ? (parseInt(channel24) || 6) : null,
      isMesh: !!isMesh
    };
    routers.push(router);
    selectedId = id;
    renderPins();
    updateUI();
    return router;
  }

  // ─── Remove Measurement ────────────────────────────────
  function removeMeasurement(id) {
    if (id && id.startsWith('router_')) {
      routers = routers.filter(r => r.id !== id);
    } else if (id && id.startsWith('shape_')) {
      if (typeof FloorPlan !== 'undefined') FloorPlan.removeShape(id);
    } else {
      measurements = measurements.filter(m => m.id !== id);
    }
    if (selectedId === id) selectedId = null;
    renderPins();
    updateUI();
  }

  // ─── Select Measurement ────────────────────────────────
  function selectMeasurement(id) {
    selectedId = id;
    renderPins();
    updateDetailPanel(id);
    updateMeasurementsList();
  }

  // ─── Update Label ──────────────────────────────────────
  function updateLabel(id, label) {
    if (id && id.startsWith('router_')) {
      const r = routers.find(r => r.id === id);
      if (r) {
        r.name = label;
      }
    } else if (id && id.startsWith('shape_')) {
      if (typeof FloorPlan !== 'undefined') {
        FloorPlan.updateShapeLabel(id, label);
      }
    } else {
      const m = measurements.find(m => m.id === id);
      if (m) {
        m.label = label;
        updateMeasurementsList();
      }
    }
  }

  // ─── Hit Test ──────────────────────────────────────────
  function hitTestPin(canvasX, canvasY) {
    const s = FloorPlan.getScale() || 1;
    // Check routers first (larger hit zone, radius 16)
    for (let i = routers.length - 1; i >= 0; i--) {
      const r = routers[i];
      const dx = canvasX - r.x;
      const dy = canvasY - r.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 16 / s) {
        selectMeasurement(r.id);
        return r;
      }
    }

    // Check measurements
    for (let i = measurements.length - 1; i >= 0; i--) {
      const m = measurements[i];
      const dx = canvasX - m.x;
      const dy = canvasY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= PIN_HIT_RADIUS / s) {
        selectMeasurement(m.id);
        return m;
      }
    }
    return null;
  }

  // ─── Mouse Move (Tooltip) ──────────────────────────────
  function handleMouseMove(canvasX, canvasY, screenX, screenY) {
    let found = null;

    for (let i = measurements.length - 1; i >= 0; i--) {
      const m = measurements[i];
      const dx = canvasX - m.x;
      const dy = canvasY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= PIN_HIT_RADIUS / (FloorPlan.getScale() || 1)) {
        found = m;
        break;
      }
    }

    if (found && found.id !== hoveredId) {
      hoveredId = found.id;
      showTooltip(found, screenX, screenY);
    } else if (!found && hoveredId) {
      hoveredId = null;
      hideTooltip();
    } else if (found) {
      moveTooltip(screenX, screenY);
    }
  }

  // ─── Tooltip ───────────────────────────────────────────
  function showTooltip(m, sx, sy) {
    const tooltip = document.getElementById('measurement-tooltip');
    if (!tooltip) return;

    tooltip.querySelector('.tooltip-ssid').textContent = m.wifi ? m.wifi.ssid : '—';

    const bandEl = tooltip.querySelector('.tooltip-band');
    if (m.wifi && m.wifi.band) {
      bandEl.textContent = m.wifi.band;
      bandEl.className = `tooltip-band band-badge ${HeatmapEngine.getBandClass(m.wifi.band)}`;
    } else {
      bandEl.textContent = '—';
      bandEl.className = 'tooltip-band';
    }

    const signal = m.wifi ? m.wifi.signal : null;
    const quality = signal !== null ? HeatmapEngine.getSignalQuality(signal) : null;
    tooltip.querySelector('.tooltip-signal').textContent = signal !== null ? `${signal} dBm` : '—';
    if (quality) {
      tooltip.querySelector('.tooltip-signal').className = `tooltip-signal ${quality.class}`;
    }

    tooltip.querySelector('.tooltip-snr').textContent = m.wifi && m.wifi.snr ? `${m.wifi.snr} dB` : '—';
    tooltip.querySelector('.tooltip-download').textContent = m.speed && m.speed.download ? `${m.speed.download} Mbps` : '—';
    tooltip.querySelector('.tooltip-upload').textContent = m.speed && m.speed.upload ? `${m.speed.upload} Mbps` : '—';
    tooltip.querySelector('.tooltip-latency').textContent = m.speed && m.speed.latency ? `${m.speed.latency} ms` : '—';

    tooltip.style.display = 'block';
    moveTooltip(sx, sy);
  }

  function moveTooltip(sx, sy) {
    const tooltip = document.getElementById('measurement-tooltip');
    if (!tooltip) return;

    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();

    let left = sx - rect.left + 16;
    let top = sy - rect.top - 30;

    // Keep within bounds
    const tw = 200;
    if (left + tw > rect.width) left = sx - rect.left - tw - 10;
    if (top < 10) top = 10;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function hideTooltip() {
    const tooltip = document.getElementById('measurement-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }

  // ─── Render Pins ───────────────────────────────────────
  function renderPins() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!pinsVisible && !routersVisible) return;

    const transform = FloorPlan.getTransform();
    const s = transform.scale;
    const ox = transform.offsetX;
    const oy = transform.offsetY;

    if (pinsVisible) {
    measurements.forEach(m => {
      const sx = m.x * s + ox;
      const sy = m.y * s + oy;

      const isSelected = m.id === selectedId;
      const isHovered = m.id === hoveredId;

      // Signal quality color
      const signal = m.wifi ? m.wifi.signal : -80;
      const quality = HeatmapEngine.getSignalQuality(signal);
      let pinColor;
      switch (quality.class) {
        case 'signal-excellent': pinColor = '#06b6d4'; break;
        case 'signal-good': pinColor = '#10b981'; break;
        case 'signal-fair': pinColor = '#fbbf24'; break;
        case 'signal-poor': pinColor = '#f97316'; break;
        case 'signal-bad': pinColor = '#ef4444'; break;
        default: pinColor = '#6366f1';
      }

      // Outer glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(sx, sy, PIN_RADIUS + 6, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
      }

      // Pin circle
      ctx.beginPath();
      ctx.arc(sx, sy, PIN_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = pinColor;
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();

      // Label (sadece seçili veya hover'da göster)
      if (m.label && s > 0.3 && (isSelected || isHovered)) {
        ctx.font = `600 ${Math.max(9, 11 / Math.max(s, 0.5))}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(m.label, sx, sy - PIN_RADIUS - 6);
        ctx.textAlign = 'left';
      }

      // Band badge
      if (m.wifi && m.wifi.band && s > 0.4) {
        const bandText = m.wifi.band;
        ctx.font = `700 8px Inter, sans-serif`;
        const tw = ctx.measureText(bandText).width;
        const bx = sx - tw / 2 - 3;
        const by = sy + PIN_RADIUS + 4;

        ctx.fillStyle = m.wifi.band === '5GHz' ? 'rgba(139, 92, 246, 0.8)' : 'rgba(6, 182, 212, 0.8)';
        roundRect(ctx, bx, by, tw + 6, 12, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(bandText, sx, by + 9);
        ctx.textAlign = 'left';
      }
    });
    } // end pinsVisible

    // Render Routers / APs
    if (routersVisible) {
    routers.forEach(r => {
      const sx = r.x * s + ox;
      const sy = r.y * s + oy;

      const isSelected = r.id === selectedId;
      const isHovered = r.id === hoveredId;

      // Outer glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(sx, sy, 12 + 6, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
      }

      // Router circle (purple theme for APs)
      ctx.beginPath();
      ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#a855f7';
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = isSelected ? 3.0 : 2.0;
      ctx.stroke();

      // Draw "AP" inside
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('AP', sx, sy + 3);
      ctx.textAlign = 'left';

      // Label (sadece seçili veya hover'da göster)
      if (r.name && s > 0.3 && (isSelected || isHovered)) {
        ctx.font = `bold ${Math.max(9, 11 / Math.max(s, 0.5))}px Inter, sans-serif`;
        ctx.fillStyle = '#d8b4fe';
        ctx.textAlign = 'center';
        ctx.fillText(r.name, sx, sy - 12 - 16);
        
        ctx.font = `600 ${Math.max(8, 9 / Math.max(s, 0.5))}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        if (r.band === '5GHz+2.4GHz') {
          ctx.fillText(`Kanal ${r.channel || 'Otomatik'} / ${r.channel24 || 'Otomatik'} (5G + 2.4G)`, sx, sy - 12 - 6);
        } else {
          ctx.fillText(`Kanal ${r.channel || 'Otomatik'} (${r.band})`, sx, sy - 12 - 6);
        }
        ctx.textAlign = 'left';
      }
    });
    } // end routersVisible
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ─── UI Updates ────────────────────────────────────────
  function updateUI() {
    updateDetailPanel(selectedId);
    updateMeasurementsList();
    updateStats();
  }

  function updateDetailPanel(id) {
    const emptyEl = document.getElementById('selected-measurement');
    const detailEl = document.getElementById('measurement-detail');
    const bodyEl = document.getElementById('measurement-detail-body');
    const remeasureBtn = document.getElementById('btn-remeasure');

    if (!id || !bodyEl) {
      if (emptyEl) emptyEl.style.display = 'block';
      if (detailEl) detailEl.style.display = 'none';
      if (remeasureBtn) remeasureBtn.style.display = 'none';
      return;
    }

    if (id.startsWith('router_')) {
      const r = routers.find(r => r.id === id);
      if (!r) return;

      if (emptyEl) emptyEl.style.display = 'none';
      if (detailEl) detailEl.style.display = 'block';
      if (remeasureBtn) remeasureBtn.style.display = 'none';

      const labelEl = document.getElementById('measurement-label');
      if (labelEl) labelEl.value = r.name || '';

      bodyEl.innerHTML = `
        <div style="background: rgba(168, 85, 247, 0.08); padding: 12px; border-radius: 6px; border: 1px solid rgba(168, 85, 247, 0.3); margin-bottom: 12px; text-align: left;">
          <h4 style="margin: 0 0 8px 0; color: #d8b4fe; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <span>📟</span> Modem / Access Point
          </h4>
          <div class="info-row" style="font-size: 0.8rem; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span style="color: rgba(255,255,255,0.6);">Çalışma Bandı</span>
            <span style="font-weight: 600; color: #a5b4fc;">${r.band === '5GHz+2.4GHz' ? 'Çift Bant (5GHz + 2.4GHz)' : r.band}</span>
          </div>
          ${r.isMesh ? `
          <div class="info-row" style="font-size: 0.8rem; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span style="color: rgba(255,255,255,0.6);">Ağ Tipi</span>
            <span style="font-weight: 600; color: #8b5cf6;">🔗 Mesh Sistem</span>
          </div>
          ` : ''}
          ${r.band === '5GHz+2.4GHz' ? `
          <div class="info-row" style="font-size: 0.8rem; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span style="color: rgba(255,255,255,0.6);">5 GHz Kanalı</span>
            <span style="font-weight: 600; color: #34d399;">Kanal ${r.channel || 'Otomatik'}</span>
          </div>
          <div class="info-row" style="font-size: 0.8rem; display: flex; justify-content: space-between;">
            <span style="color: rgba(255,255,255,0.6);">2.4 GHz Kanalı</span>
            <span style="font-weight: 600; color: #34d399;">Kanal ${r.channel24 || 'Otomatik'}</span>
          </div>
          ` : `
          <div class="info-row" style="font-size: 0.8rem; display: flex; justify-content: space-between;">
            <span style="color: rgba(255,255,255,0.6);">Kanal Numarası</span>
            <span style="font-weight: 600; color: #34d399;">Kanal ${r.channel || 'Otomatik'}</span>
          </div>
          `}
        </div>
        <p style="font-size: 0.72rem; color: rgba(255,255,255,0.45); line-height: 1.45; margin: 0 0 10px 0; font-weight: 300;">
          Bu cihazın yerleşimi, kat planındaki ölçüm noktalarının sinyal seviyeleri ile karşılaştırılarak Yapay Zeka Ağ Analizi raporunda çakışma ve kapsama sorunlarını tespit etmek için kullanılacaktır.
        </p>
      `;
      return;
    }

    if (id.startsWith('shape_')) {
      const shapes = typeof FloorPlan !== 'undefined' ? FloorPlan.getDrawingData() : [];
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;

      if (emptyEl) emptyEl.style.display = 'none';
      if (detailEl) detailEl.style.display = 'block';
      if (remeasureBtn) remeasureBtn.style.display = 'none';

      const labelEl = document.getElementById('measurement-label');
      if (labelEl) labelEl.value = shape.text || '';

      const roomType = shape.type === 'draw-rect' ? 'Dikdörtgen Oda' : 'Köşeli Oda';
      const cornerCount = shape.type === 'room-polygon' && shape.vertices ? shape.vertices.length : 4;

      bodyEl.innerHTML = `
        <div style="background: rgba(99, 102, 241, 0.08); padding: 12px; border-radius: 6px; border: 1px solid rgba(99, 102, 241, 0.3); margin-bottom: 12px; text-align: left;">
          <h4 style="margin: 0 0 8px 0; color: #a5b4fc; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <span>🏠</span> Oda Detayları
          </h4>
          <div class="info-row" style="font-size: 0.8rem; margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span style="color: rgba(255,255,255,0.6);">Oda Tipi</span>
            <span style="font-weight: 600; color: #a5b4fc;">${roomType}</span>
          </div>
          <div class="info-row" style="font-size: 0.8rem; display: flex; justify-content: space-between;">
            <span style="color: rgba(255,255,255,0.6);">Köşe Sayısı</span>
            <span style="font-weight: 600; color: #34d399;">${cornerCount}</span>
          </div>
        </div>
        <p style="font-size: 0.72rem; color: rgba(255,255,255,0.45); line-height: 1.45; margin: 0; font-weight: 300;">
          Odanın ismini üstteki alandan düzenleyebilirsiniz. Bu oda sınırları yapay zeka analizinde oda bazlı kapsama değerlendirmesi için kullanılacaktır.
        </p>
      `;
      return;
    }

    const m = measurements.find(m => m.id === id);
    if (!m) return;

    if (emptyEl) emptyEl.style.display = 'none';
    if (detailEl) detailEl.style.display = 'block';
    if (remeasureBtn) remeasureBtn.style.display = 'block';

    document.getElementById('measurement-label').value = m.label || '';

    // Check what bands we have
    const bands = m.bands || {};
    const getBandData = (b) => {
      if (bands[b]) return bands[b];
      if (m.wifi && m.wifi.band === b) return { wifi: m.wifi, speed: m.speed };
      return null;
    };

    const b24 = getBandData('2.4GHz');
    const b5 = getBandData('5GHz');

    const renderBandColumn = (title, data, badgeClass) => {
      if (!data) {
        return `
          <div class="band-column empty" style="flex: 1; opacity: 0.3; text-align: center; padding: 15px 5px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px;">
            <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 5px;">${title}</div>
            <div style="font-size: 0.75rem;">Ölçüm yok</div>
          </div>
        `;
      }

      const wifi = data.wifi || {};
      const speed = data.speed || {};
      const signal = wifi.signal;
      const quality = signal !== undefined ? HeatmapEngine.getSignalQuality(signal) : { class: '' };

      return `
        <div class="band-column" style="flex: 1; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="font-weight: 700; font-size: 0.85rem;">${title}</span>
            <span class="band-badge ${badgeClass}" style="font-size: 0.65rem; padding: 2px 6px;">${wifi.channel ? 'Ch ' + wifi.channel : 'Ağ'}</span>
          </div>
          
          <div class="info-row" style="font-size: 0.75rem; margin-bottom: 2px; display: flex; justify-content: space-between;">
            <span>Sinyal</span>
            <span class="${quality.class}" style="font-weight: 600;">${signal !== undefined ? signal + ' dBm' : '—'}</span>
          </div>
          ${wifi.signalMin !== undefined ? `
          <div style="font-size: 0.62rem; color: rgba(255,255,255,0.35); margin-bottom: 6px; text-align: right;">
            Min: ${wifi.signalMin} | Max: ${wifi.signalMax} dBm
          </div>
          ` : ''}
          
          <div class="info-row" style="font-size: 0.75rem; margin-bottom: 2px; display: flex; justify-content: space-between;">
            <span>SNR</span>
            <span style="font-weight: 600;">${wifi.snr !== undefined ? wifi.snr + ' dB' : '—'}</span>
          </div>
          ${wifi.snrMin !== undefined ? `
          <div style="font-size: 0.62rem; color: rgba(255,255,255,0.35); margin-bottom: 6px; text-align: right;">
            Min: ${wifi.snrMin} | Max: ${wifi.snrMax} dB
          </div>
          ` : ''}

          <div class="info-row" style="font-size: 0.75rem; margin-bottom: 2px; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 4px; display: flex; justify-content: space-between;">
            <span>Hız (TX Rate)</span>
            <span style="color: #6366f1; font-weight: 700;">${wifi.txRate ? wifi.txRate + ' Mbps' : '—'}</span>
          </div>
          ${wifi.txRateMin !== undefined ? `
          <div style="font-size: 0.62rem; color: rgba(255,255,255,0.35); text-align: right;">
            Min: ${wifi.txRateMin} | Max: ${wifi.txRateMax} Mbps
          </div>
          ` : ''}
        </div>
      `;
    };

    const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleString('tr-TR') : '—';
    const mainSsid = (b5 && b5.wifi && b5.wifi.ssid) || (b24 && b24.wifi && b24.wifi.ssid) || m.wifi?.ssid || 'Bilinmeyen Ağ';

    bodyEl.innerHTML = `
      <div class="info-row" style="margin-bottom: 12px; display: flex; justify-content: space-between;">
        <span>Ağ Adı (SSID)</span>
        <span style="font-weight: 600; color: #a5b4fc;">${mainSsid}</span>
      </div>
      
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        ${renderBandColumn('5 GHz', b5, 'band-5ghz')}
        ${renderBandColumn('2.4 GHz', b24, 'band-24ghz')}
      </div>
      
      <div class="info-row timestamp" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; font-size: 0.7rem; color: rgba(255,255,255,0.4); display: flex; justify-content: space-between;">
        <span>Ölçüm Tarihi</span>
        <span>${dateStr}</span>
      </div>
    `;
  }

  function updateMeasurementsList() {
    const listEl = document.getElementById('measurements-list');
    if (!listEl) return;

    if (measurements.length === 0) {
      listEl.innerHTML = '<p class="empty-state">Henüz ölçüm yok</p>';
      return;
    }

    listEl.innerHTML = measurements.map(m => {
      const signal = m.wifi ? m.wifi.signal : null;
      const quality = signal !== null ? HeatmapEngine.getSignalQuality(signal) : null;
      const dotColor = quality ? getQualityColor(quality.class) : '#606080';
      const isActive = m.id === selectedId;
      const band = m.wifi && m.wifi.band ? m.wifi.band : '';
      const dl = m.speed && m.speed.download ? `${m.speed.download} Mbps` : '';

      return `
        <div class="measurement-item ${isActive ? 'active' : ''}" data-id="${m.id}">
          <div class="measurement-dot" style="background: ${dotColor}"></div>
          <div class="measurement-info">
            <div class="label">${m.label || 'Ölçüm'}</div>
            <div class="meta">${band} ${dl ? '• ' + dl : ''}</div>
          </div>
          <div class="measurement-signal ${quality ? quality.class : ''}">${signal !== null ? signal + ' dBm' : '—'}</div>
        </div>
      `;
    }).join('');

    // Click handlers
    listEl.querySelectorAll('.measurement-item').forEach(el => {
      el.addEventListener('click', () => {
        selectMeasurement(el.dataset.id);
      });
    });
  }

  function getQualityColor(cls) {
    switch (cls) {
      case 'signal-excellent': return '#06b6d4';
      case 'signal-good': return '#10b981';
      case 'signal-fair': return '#fbbf24';
      case 'signal-poor': return '#f97316';
      case 'signal-bad': return '#ef4444';
      default: return '#606080';
    }
  }

  function updateStats() {
    const total = measurements.length;
    const band24 = measurements.filter(m => m.wifi && m.wifi.band === '2.4GHz').length;
    const band5 = measurements.filter(m => m.wifi && m.wifi.band === '5GHz').length;

    const signals = measurements.filter(m => m.wifi && m.wifi.signal !== undefined).map(m => m.wifi.signal);
    const downloads = measurements.filter(m => m.speed && m.speed.download).map(m => m.speed.download);

    const setField = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setField('stat-total', total);
    setField('stat-24ghz', band24);
    setField('stat-5ghz', band5);

    if (signals.length > 0) {
      const best = Math.max(...signals);
      const worst = Math.min(...signals);
      const bestQuality = HeatmapEngine.getSignalQuality(best);
      const worstQuality = HeatmapEngine.getSignalQuality(worst);

      const bestEl = document.getElementById('stat-best-signal');
      if (bestEl) {
        bestEl.textContent = `${best} dBm`;
        bestEl.className = bestQuality.class;
      }
      const worstEl = document.getElementById('stat-worst-signal');
      if (worstEl) {
        worstEl.textContent = `${worst} dBm`;
        worstEl.className = worstQuality.class;
      }
    }

    if (downloads.length > 0) {
      const avg = downloads.reduce((a, b) => a + b, 0) / downloads.length;
      setField('stat-avg-download', `${Math.round(avg)} Mbps`);
    }

    // Status bar
    setField('status-measurements', `Ölçüm: ${total}`);
  }

  // ─── Getters / Setters ─────────────────────────────────
  function getMeasurements() { return measurements; }
  function getSelectedId() { return selectedId; }
  function getRouters() { return routers; }

  function setMeasurements(data) {
    measurements = data || [];
    selectedId = null;
    renderPins();
    updateUI();
  }

  function setRouters(data) {
    routers = data || [];
    renderPins();
    updateUI();
  }

  function setPinsVisible(visible) {
    pinsVisible = visible;
    renderPins();
  }

  function setRoutersVisible(visible) {
    routersVisible = visible;
    renderPins();
  }

  // ─── Public API ────────────────────────────────────────
  return {
    init,
    addMeasurement,
    addRouter,
    removeMeasurement,
    selectMeasurement,
    updateLabel,
    hitTestPin,
    handleMouseMove,
    renderPins,
    getMeasurements,
    getSelectedId,
    getRouters,
    setMeasurements,
    setRouters,
    setPinsVisible,
    setRoutersVisible,
    updateUI
  };
})();
