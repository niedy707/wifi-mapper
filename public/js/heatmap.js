/**
 * HeatmapEngine Module
 * IDW (Inverse Distance Weighting) interpolation and canvas heatmap rendering
 */
const HeatmapEngine = (() => {
  let canvas, ctx;
  let isVisible = true;
  let opacity = 0.55;
  let activeLayer = 'signal'; // signal | download | upload | snr | latency
  let bandFilter = 'all';     // all | 2.4GHz | 5GHz
  let gridStep = 4; // Pixels per calculation step (performance tuning)

  // ─── Color Scales ──────────────────────────────────────
  const COLOR_SCALES = {
    signal: {
      // dBm: -90 (terrible) to -30 (excellent)
      min: -90, max: -30,
      stops: [
        { val: -90, r: 239, g: 68, b: 68 },   // Red — terrible
        { val: -75, r: 249, g: 115, b: 22 },   // Orange — poor
        { val: -65, r: 251, g: 191, b: 36 },   // Yellow — fair
        { val: -55, r: 52, g: 211, b: 153 },   // Green — good
        { val: -40, r: 16, g: 185, b: 129 },   // Emerald — great
        { val: -30, r: 6, g: 182, b: 212 },    // Cyan — excellent
      ],
      unit: 'dBm',
      label: 'Sinyal Gücü',
      invert: false
    },
    download: {
      min: 0, max: 1200,
      stops: [
        { val: 0, r: 239, g: 68, b: 68 },      // Red - 0 Mbps
        { val: 50, r: 249, g: 115, b: 22 },     // Orange - 50 Mbps
        { val: 150, r: 251, g: 191, b: 36 },    // Yellow - 150 Mbps
        { val: 300, r: 52, g: 211, b: 153 },    // Green - 300 Mbps
        { val: 600, r: 16, g: 185, b: 129 },    // Emerald - 600 Mbps
        { val: 1000, r: 99, g: 102, b: 241 },   // Indigo - 1000 Mbps
        { val: 1200, r: 6, g: 182, b: 212 },    // Cyan - 1200 Mbps
      ],
      unit: 'Mbps',
      label: 'Bağlantı Hızı (TX Rate)',
      invert: false
    },
    upload: {
      min: 0, max: 200,
      stops: [
        { val: 0, r: 239, g: 68, b: 68 },
        { val: 25, r: 249, g: 115, b: 22 },
        { val: 50, r: 251, g: 191, b: 36 },
        { val: 100, r: 52, g: 211, b: 153 },
        { val: 150, r: 139, g: 92, b: 246 },
        { val: 200, r: 168, g: 85, b: 247 },
      ],
      unit: 'Mbps',
      label: 'Upload Hızı',
      invert: false
    },
    snr: {
      min: 0, max: 60,
      stops: [
        { val: 0, r: 239, g: 68, b: 68 },
        { val: 10, r: 249, g: 115, b: 22 },
        { val: 20, r: 251, g: 191, b: 36 },
        { val: 30, r: 52, g: 211, b: 153 },
        { val: 40, r: 16, g: 185, b: 129 },
        { val: 60, r: 6, g: 182, b: 212 },
      ],
      unit: 'dB',
      label: 'SNR',
      invert: false
    },
    latency: {
      // Latency: lower is better, so invert colors
      min: 0, max: 50,
      stops: [
        { val: 0, r: 6, g: 182, b: 212 },     // Cyan — great
        { val: 5, r: 16, g: 185, b: 129 },
        { val: 10, r: 52, g: 211, b: 153 },
        { val: 20, r: 251, g: 191, b: 36 },
        { val: 35, r: 249, g: 115, b: 22 },
        { val: 50, r: 239, g: 68, b: 68 },     // Red — bad
      ],
      unit: 'ms',
      label: 'Latency',
      invert: true
    },
    noise: {
      // Noise: lower (more negative) is better
      min: -100, max: -60,
      stops: [
        { val: -100, r: 6, g: 182, b: 212 },    // Cyan — very quiet
        { val: -95, r: 16, g: 185, b: 129 },     // Emerald — quiet
        { val: -90, r: 52, g: 211, b: 153 },     // Green — good
        { val: -85, r: 251, g: 191, b: 36 },     // Yellow — moderate
        { val: -75, r: 249, g: 115, b: 22 },     // Orange — noisy
        { val: -60, r: 239, g: 68, b: 68 },      // Red — very noisy
      ],
      unit: 'dBm',
      label: 'Noise Level',
      invert: false
    }
  };

  // ─── Initialization ────────────────────────────────────
  function init() {
    canvas = document.getElementById('canvas-heatmap');
    ctx = canvas.getContext('2d');
  }

  // ─── IDW Interpolation ─────────────────────────────────
  function idwInterpolate(px, py, points, power = 2) {
    if (points.length === 0) return null;
    if (points.length === 1) return points[0].value;

    let weightSum = 0;
    let valueSum = 0;

    for (let i = 0; i < points.length; i++) {
      const dx = px - points[i].x;
      const dy = py - points[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // If exactly on a point, return its value
      if (dist < 0.001) return points[i].value;

      const weight = 1 / Math.pow(dist, power);
      weightSum += weight;
      valueSum += weight * points[i].value;
    }

    return valueSum / weightSum;
  }

  // ─── Value to Color ────────────────────────────────────
  function valueToColor(value, scaleConfig) {
    const stops = scaleConfig.stops;

    // Clamp
    if (value <= stops[0].val) return { r: stops[0].r, g: stops[0].g, b: stops[0].b };
    if (value >= stops[stops.length - 1].val) {
      const last = stops[stops.length - 1];
      return { r: last.r, g: last.g, b: last.b };
    }

    // Find surrounding stops
    for (let i = 0; i < stops.length - 1; i++) {
      if (value >= stops[i].val && value <= stops[i + 1].val) {
        const t = (value - stops[i].val) / (stops[i + 1].val - stops[i].val);
        return {
          r: Math.round(stops[i].r + (stops[i + 1].r - stops[i].r) * t),
          g: Math.round(stops[i].g + (stops[i + 1].g - stops[i].g) * t),
          b: Math.round(stops[i].b + (stops[i + 1].b - stops[i].b) * t)
        };
      }
    }

    return { r: 128, g: 128, b: 128 }; // fallback
  }

  // ─── Extract Points from Measurements ──────────────────
  function extractPoints(measurements) {
    if (!measurements || measurements.length === 0) return [];

    return measurements.map(m => {
      let value = null;
      let targetWifi = null;
      let targetSpeed = null;

      const bands = m.bands || {};
      const wifi24 = bands['2.4GHz'] ? bands['2.4GHz'].wifi : (m.wifi && m.wifi.band === '2.4GHz' ? m.wifi : null);
      const speed24 = bands['2.4GHz'] ? bands['2.4GHz'].speed : (m.wifi && m.wifi.band === '2.4GHz' ? m.speed : null);
      const wifi5 = bands['5GHz'] ? bands['5GHz'].wifi : (m.wifi && m.wifi.band === '5GHz' ? m.wifi : null);
      const speed5 = bands['5GHz'] ? bands['5GHz'].speed : (m.wifi && m.wifi.band === '5GHz' ? m.speed : null);

      if (bandFilter === 'all') {
        // Hybrid: Select the better/faster band for the active layer
        if (activeLayer === 'download' || activeLayer === 'upload' || activeLayer === 'latency') {
          const dl24 = speed24 ? speed24.download || 0 : 0;
          const dl5 = speed5 ? speed5.download || 0 : 0;
          
          if (dl5 >= dl24 && (wifi5 || speed5)) {
            targetWifi = wifi5;
            targetSpeed = speed5;
          } else if (wifi24 || speed24) {
            targetWifi = wifi24;
            targetSpeed = speed24;
          } else {
            targetWifi = m.wifi;
            targetSpeed = m.speed;
          }
        } else {
          // Compare signals for signal/snr layers
          const sig24 = wifi24 ? wifi24.signal || -100 : -100;
          const sig5 = wifi5 ? wifi5.signal || -100 : -100;
          
          if (sig5 >= sig24 && (wifi5 || speed5)) {
            targetWifi = wifi5;
            targetSpeed = speed5;
          } else if (wifi24 || speed24) {
            targetWifi = wifi24;
            targetSpeed = speed24;
          } else {
            targetWifi = m.wifi;
            targetSpeed = m.speed;
          }
        }
      } else {
        // Specific band filter: 2.4GHz or 5GHz
        if (bands[bandFilter]) {
          targetWifi = bands[bandFilter].wifi;
          targetSpeed = bands[bandFilter].speed;
        } else if (m.wifi && m.wifi.band === bandFilter) {
          targetWifi = m.wifi;
          targetSpeed = m.speed;
        }
      }

      switch (activeLayer) {
        case 'signal':
          value = targetWifi ? targetWifi.signal : null;
          break;
        case 'download':
          value = targetSpeed ? targetSpeed.download : null;
          break;
        case 'upload':
          value = targetSpeed ? targetSpeed.upload : null;
          break;
        case 'snr':
          value = targetWifi ? targetWifi.snr : null;
          break;
        case 'noise':
          // noise = signal - snr (macOS reports noise indirectly)
          value = targetWifi && targetWifi.signal != null && targetWifi.snr != null
            ? targetWifi.signal - targetWifi.snr
            : null;
          break;
        case 'latency':
          value = targetSpeed ? targetSpeed.latency : null;
          break;
      }

      if (value === null || value === undefined) return null;

      return { x: m.x, y: m.y, value };
    }).filter(p => p !== null);
  }

  // ─── Render Heatmap ────────────────────────────────────
  function render() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isVisible) return;

    const measurements = typeof Survey !== 'undefined' ? Survey.getMeasurements() : [];
    const points = extractPoints(measurements);

    if (points.length < 2) return; // Need at least 2 points for interpolation

    const scaleConfig = COLOR_SCALES[activeLayer];
    const transform = typeof FloorPlan !== 'undefined' ? FloorPlan.getTransform() : { scale: 1, offsetX: 0, offsetY: 0 };
    const floorScale = transform.scale;
    const ox = transform.offsetX;
    const oy = transform.offsetY;

    // Determine render bounds
    let imgSize = typeof FloorPlan !== 'undefined' ? FloorPlan.getImageSize() : null;
    let renderWidth, renderHeight, renderOffX, renderOffY;

    if (imgSize) {
      renderWidth = imgSize.width * floorScale;
      renderHeight = imgSize.height * floorScale;
      renderOffX = ox;
      renderOffY = oy;
    } else {
      renderWidth = canvas.width;
      renderHeight = canvas.height;
      renderOffX = 0;
      renderOffY = 0;
    }

    // Create ImageData for the render area
    const stepSize = gridStep;
    const imgW = Math.ceil(renderWidth / stepSize);
    const imgH = Math.ceil(renderHeight / stepSize);

    if (imgW <= 0 || imgH <= 0) return;

    // Use offscreen canvas for performance
    const offscreen = document.createElement('canvas');
    offscreen.width = imgW;
    offscreen.height = imgH;
    const offCtx = offscreen.getContext('2d');
    const imageData = offCtx.createImageData(imgW, imgH);
    const data = imageData.data;

    const alphaVal = Math.round(opacity * 255);

    // Calculate IDW for each grid cell
    for (let gy = 0; gy < imgH; gy++) {
      for (let gx = 0; gx < imgW; gx++) {
        // Convert grid position to canvas coordinates (in floor plan space)
        const screenX = renderOffX + gx * stepSize;
        const screenY = renderOffY + gy * stepSize;

        // Convert to floor plan coordinates
        const fpX = (screenX - ox) / floorScale;
        const fpY = (screenY - oy) / floorScale;

        const value = idwInterpolate(fpX, fpY, points);

        if (value !== null) {
          const color = valueToColor(value, scaleConfig);
          const idx = (gy * imgW + gx) * 4;
          data[idx] = color.r;
          data[idx + 1] = color.g;
          data[idx + 2] = color.b;
          data[idx + 3] = alphaVal;
        }
      }
    }

    offCtx.putImageData(imageData, 0, 0);

    // Draw scaled-up offscreen canvas onto main canvas
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      offscreen,
      0, 0, imgW, imgH,
      renderOffX, renderOffY, renderWidth, renderHeight
    );

    // Draw legend
    drawLegend(scaleConfig);
  }

  // ─── Dikey Spektrum Cetveli ─────────────────────────────
  function drawLegend(scaleConfig) {
    const barH = 220;
    const barW = 14;
    const padding = 16;
    const totalW = 180;
    const totalH = barH + 70;
    const legendX = canvas.width - totalW - 12;
    const legendY = canvas.height - totalH - 12;

    // Background panel
    ctx.fillStyle = 'rgba(8, 8, 25, 0.88)';
    ctx.strokeStyle = 'rgba(100, 100, 200, 0.15)';
    ctx.lineWidth = 1;
    roundRect(ctx, legendX, legendY, totalW, totalH, 10);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#b0b0d0';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Spektrum Cetveli', legendX + totalW / 2, legendY + 16);

    // Column headers
    ctx.font = '8px Inter, sans-serif';
    ctx.fillStyle = '#7878a0';
    ctx.textAlign = 'right';
    ctx.fillText('dBm', legendX + padding + barW / 2 - 4, legendY + 30);
    ctx.textAlign = 'left';
    ctx.fillText('Hız', legendX + padding + barW / 2 + barW + 4, legendY + 30);

    // Vertical gradient bar
    const barX = legendX + totalW / 2 - barW / 2;
    const barY = legendY + 36;

    // Draw gradient (top = good, bottom = bad)
    const gradient = ctx.createLinearGradient(0, barY, 0, barY + barH);
    const signalStops = COLOR_SCALES.signal.stops;
    const reversedStops = [...signalStops].reverse(); // Top=excellent, Bottom=terrible
    reversedStops.forEach((stop, i) => {
      const t = i / (reversedStops.length - 1);
      gradient.addColorStop(t, `rgb(${stop.r}, ${stop.g}, ${stop.b})`);
    });
    ctx.fillStyle = gradient;
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();

    // Border for bar
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.stroke();

    // Tick marks with dBm (left) and Tx Rate (right)
    const ticks = [
      { dBm: -30, rate: '800+',  quality: 'Mükemmel' },
      { dBm: -40, rate: '600',   quality: '' },
      { dBm: -50, rate: '400',   quality: '' },
      { dBm: -55, rate: '300',   quality: 'İyi' },
      { dBm: -65, rate: '150',   quality: 'Orta' },
      { dBm: -75, rate: '50',    quality: 'Zayıf' },
      { dBm: -85, rate: '6-15',  quality: '' },
      { dBm: -90, rate: '<6',    quality: 'Çok Zayıf' },
    ];

    const dBmMin = -90;
    const dBmMax = -30;

    ticks.forEach(tick => {
      const t = (tick.dBm - dBmMax) / (dBmMin - dBmMax); // 0=top(-30), 1=bottom(-90)
      const y = barY + t * barH;

      // Tick line
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(barX - 3, y);
      ctx.lineTo(barX + barW + 3, y);
      ctx.stroke();

      // dBm label (left)
      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#a0a0c0';
      ctx.textAlign = 'right';
      ctx.fillText(`${tick.dBm}`, barX - 6, y + 3);

      // Tx Rate label (right)
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8888b0';
      ctx.fillText(`${tick.rate}`, barX + barW + 6, y + 3);

      // Quality label (far right, only for key levels)
      if (tick.quality) {
        const color = valueToColor(tick.dBm, COLOR_SCALES.signal);
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.font = 'bold 7px Inter, sans-serif';
        ctx.fillText(tick.quality, barX + barW + 38, y + 3);
      }
    });

    // Unit labels at bottom of columns
    ctx.font = '7px Inter, sans-serif';
    ctx.fillStyle = '#606080';
    ctx.textAlign = 'right';
    ctx.fillText('(dBm)', barX - 6, barY + barH + 14);
    ctx.textAlign = 'left';
    ctx.fillText('(Mbps)', barX + barW + 6, barY + barH + 14);

    // Band filter & point count
    const bandText = bandFilter === 'all' ? 'Tüm Bantlar' : bandFilter;
    ctx.fillStyle = '#7c8cf8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Bant: ${bandText}`, legendX + totalW / 2, barY + barH + 30);

    const measurements = typeof Survey !== 'undefined' ? Survey.getMeasurements() : [];
    const filteredCount = extractPoints(measurements).length;
    ctx.fillStyle = '#606080';
    ctx.fillText(`${filteredCount} ölçüm noktası`, legendX + totalW / 2, barY + barH + 42);

    ctx.textAlign = 'left';
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

  // ─── Settings ──────────────────────────────────────────
  function setLayer(layer) {
    activeLayer = layer;
    render();
  }

  function setBandFilter(band) {
    bandFilter = band;
    render();
  }

  function setVisible(visible) {
    isVisible = visible;
    render();
  }

  function setOpacity(val) {
    opacity = val;
    render();
  }

  function getSignalQuality(dBm) {
    if (dBm >= -40) return { label: 'Mükemmel', class: 'signal-excellent' };
    if (dBm >= -55) return { label: 'Çok İyi', class: 'signal-good' };
    if (dBm >= -65) return { label: 'İyi', class: 'signal-fair' };
    if (dBm >= -75) return { label: 'Zayıf', class: 'signal-poor' };
    return { label: 'Çok Zayıf', class: 'signal-bad' };
  }

  function getBandClass(band) {
    if (band === '2.4GHz') return 'band-24';
    if (band === '5GHz') return 'band-5';
    if (band === '6GHz') return 'band-6';
    return '';
  }

  // ─── Public API ────────────────────────────────────────
  return {
    init,
    render,
    setLayer,
    setBandFilter,
    setVisible,
    setOpacity,
    getSignalQuality,
    getBandClass,
    getColorScales: () => COLOR_SCALES,
    getActiveLayer: () => activeLayer,
    getBandFilter: () => bandFilter
  };
})();
