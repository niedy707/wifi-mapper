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
      label: 'Gecikme',
      invert: true
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

  // ─── Legend ────────────────────────────────────────────
  function drawLegend(scaleConfig) {
    const legendX = canvas.width - 200;
    const legendY = canvas.height - 120;
    const legendW = 170;
    const legendH = 100;

    // Background
    ctx.fillStyle = 'rgba(10, 10, 30, 0.8)';
    ctx.strokeStyle = 'rgba(100, 100, 200, 0.2)';
    ctx.lineWidth = 1;
    roundRect(ctx, legendX, legendY, legendW, legendH, 10);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#9898b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(scaleConfig.label, legendX + 10, legendY + 18);

    // Gradient bar
    const barX = legendX + 10;
    const barY = legendY + 26;
    const barW = legendW - 20;
    const barH = 12;

    const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    const stops = scaleConfig.stops;
    const range = stops[stops.length - 1].val - stops[0].val;

    stops.forEach(stop => {
      const t = (stop.val - stops[0].val) / range;
      gradient.addColorStop(t, `rgb(${stop.r}, ${stop.g}, ${stop.b})`);
    });

    ctx.fillStyle = gradient;
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();

    // Labels
    ctx.fillStyle = '#606080';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${stops[0].val} ${scaleConfig.unit}`, barX, barY + barH + 14);
    ctx.textAlign = 'right';
    ctx.fillText(`${stops[stops.length - 1].val} ${scaleConfig.unit}`, barX + barW, barY + barH + 14);
    ctx.textAlign = 'left';

    // Band filter badge
    const bandText = bandFilter === 'all' ? 'Tüm Bantlar' : bandFilter;
    ctx.fillStyle = '#7c8cf8';
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText(`Bant: ${bandText}`, barX, barY + barH + 30);

    // Point count
    const measurements = typeof Survey !== 'undefined' ? Survey.getMeasurements() : [];
    const filteredCount = extractPoints(measurements).length;
    ctx.fillStyle = '#606080';
    ctx.fillText(`${filteredCount} ölçüm noktası`, barX, barY + barH + 42);
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
