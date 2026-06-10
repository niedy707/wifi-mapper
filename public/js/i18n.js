/**
 * i18n Module — Internationalization
 * Default: English, Supported: Turkish
 */
const I18n = (() => {
  let currentLang = localStorage.getItem('wifimapper-lang') || 'en';

  const translations = {
    en: {
      // Header
      'app.title': 'WifiMapper',
      'project.select': '— Select Project —',
      'project.new': 'New Project',
      'project.save': 'Save',
      'project.delete': 'Delete',
      'wifi.waiting': 'Waiting for connection…',

      // Tools
      'tools.title': 'Tools',
      'tool.select': 'Select',
      'tool.measure': 'Measure',
      'tool.router': 'Router/AP',
      'tool.drawRect': 'Draw Rect',
      'tool.polygon': 'Set Corners',
      'tool.wall': 'Wall',
      'tool.text': 'Text',
      'tool.eraser': 'Erase',
      'tools.clearRooms': '🗑️ Clear All Rooms',

      // Floor Plan
      'floorplan.title': 'Floor Plan',
      'floorplan.upload': '📁 Upload Image',
      'floorplan.clear': '🧹 Clear',

      // Measurement Mode
      'mode.title': 'Measurement Mode',
      'mode.smart': '⚡ Dual Band (Smart Hybrid)',
      'mode.manual': '🔄 Dual Band (Step by Step)',
      'mode.current': '📶 Single Band (Connected Only)',
      'mode.quick': '🚀 Quick (1 Sample)',
      'mode.hint.smart': 'Smart Hybrid: Measures connected band, scans the other band and estimates its speed based on signal.',
      'mode.hint.manual': 'Step by Step: Tests the connected band first, then asks you to switch and tests the other band.',
      'mode.hint.current': 'Single Band: Measures only the currently connected band.',
      'mode.hint.quick': '⚠️ Quick mode takes a single sample. Based on our analysis, 64% of measurements show ≥3 dBm variance and 27% show ≥5 dBm in 5 samples. Results may be less accurate.',

      // Sample count
      'sample.title': 'Sample Count',
      'sample.1': '🚀 Quick (1 sample)',
      'sample.3': '⚡ Fast (3 samples)',
      'sample.5': '📊 Standard (5 samples)',
      'sample.quickWarning': '⚠️ Quick mode: Single sample may be inaccurate. In our tests, 64% of measurements showed ≥3 dBm variance across 5 samples.',

      // Draw Options
      'draw.title': 'Draw Settings',
      'draw.color': 'Color',
      'draw.width': 'Width',

      // Heatmap
      'heatmap.title': 'Heatmap',
      'heatmap.layer': 'Layer',
      'heatmap.layer.signal': 'Signal Strength (dBm)',
      'heatmap.layer.download': 'Link Speed (TX Rate)',
      'heatmap.layer.snr': 'SNR (dB)',
      'heatmap.layer.noise': 'Noise Level (dBm)',
      'heatmap.band': 'Band Filter',
      'heatmap.band.all': 'Hybrid (Best Band)',
      'heatmap.band.24': '2.4 GHz Only',
      'heatmap.band.5': '5 GHz Only',
      'heatmap.show': 'Show Heatmap',
      'heatmap.opacity': 'Opacity',
      'heatmap.showPins': 'Show Pins',
      'heatmap.showRouters': 'Show Routers',
      'heatmap.showRooms': 'Show Rooms',

      // AI
      'ai.title': '🧠 AI Analysis',
      'ai.analyze': 'Analyze Network',
      'ai.report.title': '🧠 AI WiFi Analysis Report',
      'ai.report.print': '🖨️ Print Report',
      'ai.report.pdf': '📄 Download PDF',
      'ai.report.ok': 'OK',

      // Export
      'export.title': 'Export',
      'export.png': '📷 Save PNG',
      'export.json': '📄 Download JSON',
      'export.csv': '📊 Download CSV',
      'export.report': '📋 Generate Report',

      // Welcome
      'welcome.title': 'Welcome to WifiMapper',
      'welcome.desc': 'Upload a floor plan or start drawing directly to map your WiFi coverage.',
      'welcome.upload': '📁 Upload Floor Plan',
      'welcome.draw': '✏️ Start with Blank Canvas',
      'welcome.hint': 'Supports PNG, JPG, and SVG formats',

      // Polygon Actions
      'polygon.hint': 'Click corners to draw a room:',
      'polygon.togglePins': 'Hide Measurements',
      'polygon.togglePinsShow': 'Show Measurements',
      'polygon.complete': 'Complete',
      'polygon.cancel': 'Cancel',

      // Measurement Overlay
      'measure.result': 'Measurement Result',

      // Tooltip
      'tooltip.signal': 'Signal',
      'tooltip.snr': 'SNR',
      'tooltip.download': 'Download',
      'tooltip.upload': 'Upload',
      'tooltip.latency': 'Latency',

      // Details Panel
      'details.title': 'Details',
      'details.empty': 'Select a measurement point on the map to see details.',
      'details.measurements': 'Measurements',
      'details.noMeasurements': 'No measurements yet. Select the Measure tool and click on the map.',

      // Status Bar
      'status.tool': 'Tool',
      'status.measurements': 'measurements',
      'status.routers': 'routers',

      // Modals
      'modal.newProject': '📁 New Project',
      'modal.projectName': 'Project Name',
      'modal.projectPlaceholder': 'e.g., Home WiFi Survey',
      'modal.create': 'Create',
      'modal.cancel': 'Cancel',
      'modal.router.title': '📡 Add Router / AP',
      'modal.router.name': 'Router Name',
      'modal.router.namePlaceholder': 'e.g., Living Room Router',
      'modal.router.band': 'Band',
      'modal.router.channel': 'Channel (5 GHz)',
      'modal.router.channel24': 'Channel (2.4 GHz)',
      'modal.router.mesh': '🔗 Mesh System Device',
      'modal.router.add': 'Add',
      'modal.measuring.title': '📡 Measuring...',

      // Context Menu
      'ctx.rename': '✏️ Rename',
      'ctx.delete': '🗑️ Delete',

      // AI Analysis Strings
      'ai.overallScore': 'Overall Score',
      'ai.meshInfo': 'devices marked as <strong>Mesh System</strong>. Same channel/SSID usage is normal for Mesh networks, interference warnings between these devices are disabled.',
      'ai.roomAnalysis': '🏠 Room-by-Room WiFi Status',
      'ai.roomHint': '💡 <strong>Tip:</strong> Draw rooms using "Draw Rect" or "Set Corners" to enable room-based analysis.',
      'ai.noMeasurement': 'No Measurement',
      'ai.excellent': 'Excellent',
      'ai.good': 'Good',
      'ai.fair': 'Fair',
      'ai.weak': 'Weak',
      'ai.veryWeak': 'Very Weak',
      'ai.unnamed': 'Unnamed Room',
      'ai.measurements': 'measurements',
      'ai.avg': 'Avg',

      // Spectrum Legend
      'legend.title': 'Spectrum Ruler',
      'legend.dbm': 'dBm',
      'legend.speed': 'Speed',
      'legend.allBands': 'All Bands',
      'legend.points': 'measurement points',

      // Confirmations
      'confirm.deleteRoom': 'room(s) will be deleted. Are you sure?',
      'confirm.deleteProject': 'This project will be permanently deleted. Are you sure?',
      'confirm.clearFloorplan': 'Clear the floor plan image?',

      // Status Messages
      'status.saved': 'Project saved',
      'status.deleted': 'deleted',
      'status.roomsDeleted': 'rooms deleted',
      'status.noRooms': 'No rooms to delete',
      'status.measureMode': 'Measure mode: Click on map to add measurement point',

      // Signal Quality
      'quality.excellent': 'Excellent Signal',
      'quality.veryGood': 'Very Good Signal',
      'quality.good': 'Good Signal',
      'quality.weak': 'Weak Signal',
      'quality.veryWeak': 'Very Weak Signal',

      // Device Badge
      'device.mobile': 'Mobile',
      'device.tablet': 'Tablet',
      'device.desktop': 'Desktop',
    },

    tr: {
      // Header
      'app.title': 'WifiMapper',
      'project.select': '— Proje Seç —',
      'project.new': 'Yeni Proje',
      'project.save': 'Kaydet',
      'project.delete': 'Sil',
      'wifi.waiting': 'Bağlantı bekleniyor…',

      // Tools
      'tools.title': 'Araçlar',
      'tool.select': 'Seç',
      'tool.measure': 'Ölçüm',
      'tool.router': 'Modem/AP',
      'tool.drawRect': 'Dikdörtgen Çiz',
      'tool.polygon': 'Köşeleri Belirle',
      'tool.wall': 'Duvar',
      'tool.text': 'Metin',
      'tool.eraser': 'Sil',
      'tools.clearRooms': '🗑️ Tüm Odaları Sil',

      // Floor Plan
      'floorplan.title': 'Kat Planı',
      'floorplan.upload': '📁 Resim Yükle',
      'floorplan.clear': '🧹 Temizle',

      // Measurement Mode
      'mode.title': 'Ölçüm Modu',
      'mode.smart': '⚡ Çift Bant (Akıllı Hibrit)',
      'mode.manual': '🔄 Çift Bant (Adım Adım Tam)',
      'mode.current': '📶 Tek Bant (Sadece Bağlı)',
      'mode.quick': '🚀 Hızlı (1 Örneklem)',
      'mode.hint.smart': 'Akıllı Hibrit: Bağlı bandı ölçer, diğer bandı tarayıp hızını sinyale göre otomatik tahmin eder.',
      'mode.hint.manual': 'Adım Adım: Önce bağlı bandı test eder, sonra diğer banda geçmenizi isteyip orayı da test eder.',
      'mode.hint.current': 'Tek Bant: Sadece o anda bağlı olduğunuz bandı ölçer.',
      'mode.hint.quick': '⚠️ Hızlı mod tek bir örneklem alır. Analizlerimize göre ölçümlerin %64\'ünde ≥3 dBm, %27\'sinde ≥5 dBm sapma var. Sonuçlar daha az doğru olabilir.',

      // Sample count
      'sample.title': 'Örneklem Sayısı',
      'sample.1': '🚀 Hızlı (1 örneklem)',
      'sample.3': '⚡ Orta (3 örneklem)',
      'sample.5': '📊 Standart (5 örneklem)',
      'sample.quickWarning': '⚠️ Hızlı mod: Tek örneklem hatalı sonuç verebilir. Testlerimizde ölçümlerin %64\'ünde 5 örneklemde ≥3 dBm sapma tespit edildi.',

      // Draw Options
      'draw.title': 'Çizim Ayarları',
      'draw.color': 'Renk',
      'draw.width': 'Kalınlık',

      // Heatmap
      'heatmap.title': 'Heatmap',
      'heatmap.layer': 'Katman',
      'heatmap.layer.signal': 'Sinyal Gücü (dBm)',
      'heatmap.layer.download': 'Bağlantı Hızı (TX Rate)',
      'heatmap.layer.snr': 'SNR (dB)',
      'heatmap.layer.noise': 'Gürültü Seviyesi (dBm)',
      'heatmap.band': 'Bant Filtresi',
      'heatmap.band.all': 'Hibrit (Hangisi Hızlıysa)',
      'heatmap.band.24': 'Sadece 2.4 GHz',
      'heatmap.band.5': 'Sadece 5 GHz',
      'heatmap.show': 'Heatmap Göster',
      'heatmap.opacity': 'Opaklık',
      'heatmap.showPins': 'Pin\'leri Göster',
      'heatmap.showRouters': 'Modemleri Göster',
      'heatmap.showRooms': 'Odaları Göster',

      // AI
      'ai.title': '🧠 Yapay Zeka (AI)',
      'ai.analyze': 'Ağ Analizi Yap',
      'ai.report.title': '🧠 AI WiFi Analiz Raporu',
      'ai.report.print': '🖨️ Raporu Yazdır',
      'ai.report.pdf': '📄 PDF İndir',
      'ai.report.ok': 'Tamam',

      // Export
      'export.title': 'Dışa Aktar',
      'export.png': '📷 PNG Kaydet',
      'export.json': '📄 JSON İndir',
      'export.csv': '📊 CSV İndir',
      'export.report': '📋 Rapor Oluştur',

      // Welcome
      'welcome.title': 'WifiMapper\'a Hoş Geldiniz',
      'welcome.desc': 'WiFi kapsama alanınızı haritalamaya başlamak için bir kat planı yükleyin veya doğrudan çizim yapın.',
      'welcome.upload': '📁 Kat Planı Yükle',
      'welcome.draw': '✏️ Boş Canvas ile Başla',
      'welcome.hint': 'PNG, JPG veya SVG formatlarını destekler',

      // Polygon Actions
      'polygon.hint': 'Köşeleri tıklayarak oda çizin:',
      'polygon.togglePins': 'Ölçümleri Gizle',
      'polygon.togglePinsShow': 'Ölçümleri Göster',
      'polygon.complete': 'Tamamla',
      'polygon.cancel': 'İptal',

      // Measurement Overlay
      'measure.result': 'Ölçüm Sonucu',

      // Tooltip
      'tooltip.signal': 'Sinyal',
      'tooltip.snr': 'SNR',
      'tooltip.download': 'Download',
      'tooltip.upload': 'Upload',
      'tooltip.latency': 'Gecikme',

      // Details Panel
      'details.title': 'Detaylar',
      'details.empty': 'Detayları görmek için haritadaki bir ölçüm noktasını seçin.',
      'details.measurements': 'Ölçümler',
      'details.noMeasurements': 'Henüz ölçüm yok. Ölçüm aracını seçin ve haritaya tıklayın.',

      // Status Bar
      'status.tool': 'Araç',
      'status.measurements': 'ölçüm',
      'status.routers': 'modem',

      // Modals
      'modal.newProject': '📁 Yeni Proje',
      'modal.projectName': 'Proje Adı',
      'modal.projectPlaceholder': 'Örn: Ev WiFi Taraması',
      'modal.create': 'Oluştur',
      'modal.cancel': 'İptal',
      'modal.router.title': '📡 Modem / AP Ekle',
      'modal.router.name': 'Modem Adı',
      'modal.router.namePlaceholder': 'Örn: Salon Modemi',
      'modal.router.band': 'Bant',
      'modal.router.channel': 'Kanal (5 GHz)',
      'modal.router.channel24': 'Kanal (2.4 GHz)',
      'modal.router.mesh': '🔗 Mesh Sistem Cihazı',
      'modal.router.add': 'Ekle',
      'modal.measuring.title': '📡 Ölçülüyor...',

      // Context Menu
      'ctx.rename': '✏️ İsmi Değiştir',
      'ctx.delete': '🗑️ Sil',

      // AI Analysis Strings
      'ai.overallScore': 'Genel Durum',
      'ai.meshInfo': 'cihaz <strong>Mesh Sistem</strong> olarak işaretlenmiş. Aynı kanal ve SSID kullanımı Mesh ağlar için normaldir, bu cihazlar arası çakışma uyarıları devre dışı bırakıldı.',
      'ai.roomAnalysis': '🏠 Oda Bazlı WiFi Durumu',
      'ai.roomHint': '💡 <strong>İpucu:</strong> Sol araçlardan "Dikdörtgen Çiz" veya "Köşeleri Belirle" ile odalarınızı çizerek oda bazlı analiz yapabilirsiniz.',
      'ai.noMeasurement': 'Ölçüm Yok',
      'ai.excellent': 'Mükemmel',
      'ai.good': 'İyi',
      'ai.fair': 'Orta',
      'ai.weak': 'Zayıf',
      'ai.veryWeak': 'Çok Zayıf',
      'ai.unnamed': 'İsimsiz Oda',
      'ai.measurements': 'ölçüm',
      'ai.avg': 'Ort',

      // Spectrum Legend
      'legend.title': 'Spektrum Cetveli',
      'legend.dbm': 'dBm',
      'legend.speed': 'Hız',
      'legend.allBands': 'Tüm Bantlar',
      'legend.points': 'ölçüm noktası',

      // Confirmations
      'confirm.deleteRoom': 'adet oda silinecek. Emin misiniz?',
      'confirm.deleteProject': 'Bu proje kalıcı olarak silinecek. Emin misiniz?',
      'confirm.clearFloorplan': 'Kat planı temizlensin mi?',

      // Status Messages
      'status.saved': 'Proje kaydedildi',
      'status.deleted': 'silindi',
      'status.roomsDeleted': 'oda silindi',
      'status.noRooms': 'Silinecek oda bulunamadı',
      'status.measureMode': 'Ölçüm modu: Haritaya tıklayarak ölçüm noktası ekleyin',

      // Signal Quality
      'quality.excellent': 'Mükemmel Sinyal',
      'quality.veryGood': 'Çok İyi Sinyal',
      'quality.good': 'İyi Sinyal',
      'quality.weak': 'Zayıf Sinyal',
      'quality.veryWeak': 'Çok Zayıf Sinyal',

      // Device Badge
      'device.mobile': 'Mobil',
      'device.tablet': 'Tablet',
      'device.desktop': 'Masaüstü',
    }
  };

  function t(key) {
    return (translations[currentLang] && translations[currentLang][key]) 
      || (translations['en'] && translations['en'][key]) 
      || key;
  }

  function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('wifimapper-lang', lang);
    applyTranslations();
    // Dispatch event so other modules can react
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }

  function getLanguage() {
    return currentLang;
  }

  function applyTranslations() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(key);
      if (el.tagName === 'INPUT' && el.type === 'text') {
        el.placeholder = text;
      } else if (el.tagName === 'OPTION') {
        el.textContent = text;
      } else {
        el.textContent = text;
      }
    });

    // Update title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });

    // Update placeholder attributes  
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    // Update lang toggle button
    const langBtn = document.getElementById('btn-lang-toggle');
    if (langBtn) {
      langBtn.textContent = currentLang === 'en' ? '🇹🇷 TR' : '🇬🇧 EN';
      langBtn.title = currentLang === 'en' ? 'Türkçe\'ye geç' : 'Switch to English';
    }
  }

  // Public API
  return { t, setLanguage, getLanguage, applyTranslations };
})();
