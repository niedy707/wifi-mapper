/**
 * Export Module
 * PNG, JSON, CSV, HTML report export
 */
const ExportModule = (() => {

  // ─── Export as PNG ─────────────────────────────────────
  function exportPNG() {
    const canvasSize = FloorPlan.getCanvasSize();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasSize.width;
    exportCanvas.height = canvasSize.height;
    const ctx = exportCanvas.getContext('2d');

    // Layer 1: Dark background
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Layer 2: Floor plan
    const fpCanvas = document.getElementById('canvas-floorplan');
    ctx.drawImage(fpCanvas, 0, 0);

    // Layer 3: Heatmap
    const hmCanvas = document.getElementById('canvas-heatmap');
    ctx.drawImage(hmCanvas, 0, 0);

    // Layer 4: Drawing
    const drCanvas = document.getElementById('canvas-drawing');
    ctx.drawImage(drCanvas, 0, 0);

    // Layer 5: Pins
    const pinCanvas = document.getElementById('canvas-pins');
    ctx.drawImage(pinCanvas, 0, 0);

    // Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WifiMapper — ' + new Date().toLocaleDateString('tr-TR'), canvasSize.width - 12, canvasSize.height - 10);

    // Download
    const link = document.createElement('a');
    link.download = `wifi-heatmap-${getDateString()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  // ─── Export as JSON ────────────────────────────────────
  function exportJSON() {
    const data = {
      exportDate: new Date().toISOString(),
      tool: 'WifiMapper',
      version: '1.0.0',
      measurements: Survey.getMeasurements(),
      routers: Survey.getRouters(),
      summary: generateSummary()
    };

    downloadFile(
      JSON.stringify(data, null, 2),
      `wifi-survey-${getDateString()}.json`,
      'application/json'
    );
  }

  // ─── Export as CSV ─────────────────────────────────────
  function exportCSV() {
    const measurements = Survey.getMeasurements();

    if (measurements.length === 0) {
      alert('Dışa aktarılacak ölçüm yok.');
      return;
    }

    const headers = [
      'Etiket', 'X', 'Y', 'Tarih',
      'SSID', 'Sinyal (dBm)', 'Gürültü (dBm)', 'SNR (dB)',
      'Kanal', 'Bant', 'PHY Mode', 'TX Rate (Mbps)',
      'Download (Mbps)', 'Upload (Mbps)', 'Gecikme (ms)', 'Jitter (ms)'
    ];

    const rows = measurements.map(m => [
      m.label || '',
      m.x, m.y,
      m.timestamp || '',
      m.wifi ? m.wifi.ssid || '' : '',
      m.wifi ? m.wifi.signal || '' : '',
      m.wifi ? m.wifi.noise || '' : '',
      m.wifi ? m.wifi.snr || '' : '',
      m.wifi ? m.wifi.channel || '' : '',
      m.wifi ? m.wifi.band || '' : '',
      m.wifi ? m.wifi.phyMode || '' : '',
      m.wifi ? m.wifi.txRate || '' : '',
      m.speed ? m.speed.download || '' : '',
      m.speed ? m.speed.upload || '' : '',
      m.speed ? m.speed.latency || '' : '',
      m.speed ? m.speed.jitter || '' : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    downloadFile(
      '\uFEFF' + csvContent, // BOM for UTF-8 Excel compatibility
      `wifi-survey-${getDateString()}.csv`,
      'text/csv'
    );
  }

  // ─── Export HTML Report ────────────────────────────────
  function exportReport() {
    const measurements = Survey.getMeasurements();

    if (measurements.length === 0) {
      alert('Rapor oluşturmak için en az 1 ölçüm gerekli.');
      return;
    }

    const summary = generateSummary();

    // Generate heatmap image
    const canvasSize = FloorPlan.getCanvasSize();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasSize.width;
    exportCanvas.height = canvasSize.height;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.drawImage(document.getElementById('canvas-floorplan'), 0, 0);
    ctx.drawImage(document.getElementById('canvas-heatmap'), 0, 0);
    ctx.drawImage(document.getElementById('canvas-pins'), 0, 0);
    const heatmapImgURL = exportCanvas.toDataURL('image/png');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WiFi Survey Raporu — ${new Date().toLocaleDateString('tr-TR')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; color: #1d1d1f; padding: 40px 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    .subtitle { color: #86868b; margin-bottom: 32px; }
    .card { background: white; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .card h2 { font-size: 18px; margin-bottom: 16px; color: #1d1d1f; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .stat-box { text-align: center; padding: 16px; background: #f5f5f7; border-radius: 12px; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #86868b; margin-top: 4px; }
    .excellent { color: #34c759; }
    .good { color: #30d158; }
    .fair { color: #ff9f0a; }
    .poor { color: #ff6723; }
    .bad { color: #ff3b30; }
    .heatmap-img { width: 100%; border-radius: 12px; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px; color: #86868b; font-weight: 600; border-bottom: 2px solid #e5e5ea; }
    td { padding: 8px; border-bottom: 1px solid #f2f2f7; }
    .band { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .band-24 { background: rgba(6,182,212,0.1); color: #06b6d4; }
    .band-5 { background: rgba(139,92,246,0.1); color: #8b5cf6; }
    .footer { text-align: center; margin-top: 40px; color: #86868b; font-size: 12px; }
    .recommendations { padding: 0; list-style: none; }
    .recommendations li { padding: 8px 0; padding-left: 24px; position: relative; }
    .recommendations li::before { content: '💡'; position: absolute; left: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📡 WiFi Survey Raporu</h1>
    <p class="subtitle">Oluşturulma: ${new Date().toLocaleString('tr-TR')} — WifiMapper v1.0</p>

    <div class="card">
      <h2>Özet İstatistikler</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${summary.total}</div>
          <div class="stat-label">Toplam Ölçüm</div>
        </div>
        <div class="stat-box">
          <div class="stat-value ${getSignalClass(summary.avgSignal)}">${summary.avgSignal !== null ? summary.avgSignal + ' dBm' : '—'}</div>
          <div class="stat-label">Ort. Sinyal</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${summary.avgDownload !== null ? summary.avgDownload + ' Mbps' : '—'}</div>
          <div class="stat-label">Ort. Download</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${summary.avgUpload !== null ? summary.avgUpload + ' Mbps' : '—'}</div>
          <div class="stat-label">Ort. Upload</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${summary.band24}</div>
          <div class="stat-label">2.4 GHz Ölçüm</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${summary.band5}</div>
          <div class="stat-label">5 GHz Ölçüm</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>🗺️ Heatmap</h2>
      <img src="${heatmapImgURL}" class="heatmap-img" alt="WiFi Heatmap">
    </div>

    <div class="card">
      <h2>📋 Ölçüm Detayları</h2>
      <table>
        <thead>
          <tr>
            <th>Etiket</th>
            <th>Sinyal</th>
            <th>Bant</th>
            <th>Download</th>
            <th>Upload</th>
            <th>Gecikme</th>
          </tr>
        </thead>
        <tbody>
          ${measurements.map(m => `
            <tr>
              <td>${m.label || '—'}</td>
              <td class="${m.wifi ? getSignalClass(m.wifi.signal) : ''}">${m.wifi && m.wifi.signal !== undefined ? m.wifi.signal + ' dBm' : '—'}</td>
              <td>${m.wifi && m.wifi.band ? `<span class="band ${m.wifi.band === '5GHz' ? 'band-5' : 'band-24'}">${m.wifi.band}</span>` : '—'}</td>
              <td>${m.speed && m.speed.download ? m.speed.download + ' Mbps' : '—'}</td>
              <td>${m.speed && m.speed.upload ? m.speed.upload + ' Mbps' : '—'}</td>
              <td>${m.speed && m.speed.latency ? m.speed.latency + ' ms' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>💡 Öneriler</h2>
      <ul class="recommendations">
        ${generateRecommendations(measurements, summary).map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    <div class="footer">
      <p>Bu rapor WifiMapper ile otomatik oluşturulmuştur.</p>
    </div>
  </div>
</body>
</html>`;

    downloadFile(
      html,
      `wifi-rapor-${getDateString()}.html`,
      'text/html'
    );
  }

  // ─── Helpers ───────────────────────────────────────────
  function generateSummary() {
    const measurements = Survey.getMeasurements();
    const signals = measurements.filter(m => m.wifi && m.wifi.signal !== undefined).map(m => m.wifi.signal);
    const downloads = measurements.filter(m => m.speed && m.speed.download).map(m => m.speed.download);
    const uploads = measurements.filter(m => m.speed && m.speed.upload).map(m => m.speed.upload);
    const latencies = measurements.filter(m => m.speed && m.speed.latency).map(m => m.speed.latency);

    return {
      total: measurements.length,
      band24: measurements.filter(m => m.wifi && m.wifi.band === '2.4GHz').length,
      band5: measurements.filter(m => m.wifi && m.wifi.band === '5GHz').length,
      avgSignal: signals.length ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length) : null,
      bestSignal: signals.length ? Math.max(...signals) : null,
      worstSignal: signals.length ? Math.min(...signals) : null,
      avgDownload: downloads.length ? Math.round(downloads.reduce((a, b) => a + b, 0) / downloads.length) : null,
      avgUpload: uploads.length ? Math.round(uploads.reduce((a, b) => a + b, 0) / uploads.length) : null,
      avgLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length * 10) / 10 : null
    };
  }

  function generateRecommendations(measurements, summary) {
    const recs = [];

    if (summary.total < 5) {
      recs.push('Daha doğru bir heatmap için en az 8-10 farklı noktada ölçüm yapmanız önerilir.');
    }

    if (summary.worstSignal !== null && summary.worstSignal < -75) {
      const weakPoints = measurements.filter(m => m.wifi && m.wifi.signal < -75);
      recs.push(`${weakPoints.length} noktada sinyal zayıf (< -75 dBm). Bu bölgelere WiFi tekrarlayıcı (repeater) veya mesh ünite eklemeyi düşünebilirsiniz.`);
    }

    if (summary.band24 > 0 && summary.band5 > 0) {
      const avg24 = measurements.filter(m => m.wifi && m.wifi.band === '2.4GHz' && m.speed && m.speed.download)
        .reduce((sum, m) => sum + m.speed.download, 0) / Math.max(1, summary.band24);
      const avg5 = measurements.filter(m => m.wifi && m.wifi.band === '5GHz' && m.speed && m.speed.download)
        .reduce((sum, m) => sum + m.speed.download, 0) / Math.max(1, summary.band5);

      if (avg5 > avg24 * 1.5) {
        recs.push('5 GHz bandı 2.4 GHz\'den belirgin şekilde daha hızlı. Mümkünse cihazlarınızı 5 GHz ağa bağlayın.');
      }
    }

    if (summary.avgLatency !== null && summary.avgLatency > 15) {
      recs.push('Ortalama gecikme yüksek. Yoğun bant kullanımı veya kanal çakışması olabilir.');
    }

    if (summary.avgDownload !== null && summary.avgDownload < 50) {
      recs.push('Ortalama download hızı düşük. Router\'ınızı daha merkezi bir konuma taşımayı deneyin.');
    }

    if (recs.length === 0) {
      recs.push('WiFi kapsama alanınız genel olarak iyi durumda görünüyor. Düzenli aralıklarla test yaparak durumu takip edebilirsiniz.');
    }

    return recs;
  }

  function getSignalClass(dBm) {
    if (dBm === null || dBm === undefined) return '';
    if (dBm >= -40) return 'excellent';
    if (dBm >= -55) return 'good';
    if (dBm >= -65) return 'fair';
    if (dBm >= -75) return 'poor';
    return 'bad';
  }

  function getDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ─── Public API ────────────────────────────────────────
  return {
    exportPNG,
    exportJSON,
    exportCSV,
    exportReport
  };
})();
