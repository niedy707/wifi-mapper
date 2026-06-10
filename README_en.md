# 📡 WifiMapper — WiFi Heatmap & Survey Tool

> **Free, open-source, professional-grade WiFi coverage mapping tool for macOS.**
> A powerful alternative to NetSpot ($49+) and Ekahau ($3,000+).

🇹🇷 [Türkçe Dokümantasyon →](README_tr.md)

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/niedy707/wifi-mapper.git

# Navigate to the project
cd wifi-mapper

# Install dependencies
npm install

# Start the server
node server.js

# Open in your browser
open http://localhost:3333
```

> 📋 **Copy & paste the command above** to get started in under 30 seconds.

---

## ✨ Features

### 🗺️ Interactive Floor Plan Mapping
- Upload any floor plan image (PNG, JPG, SVG) as a background
- Draw rooms using **rectangle** or **freeform polygon** tools
- Add walls, text annotations, and custom drawings
- Pan, zoom, and navigate with mouse/touchpad
- Double-click rooms to rename or delete them

### 📡 Real-Time WiFi Measurement
- **5-second statistical sampling** — takes 5 samples and computes min/max/average for reliable data
- **Quick mode** (1 sample) for fast surveys with accuracy warning
- Measures: Signal strength (dBm), Noise floor, SNR, TX Rate, PHY Mode, Channel, Band
- **Smart Hybrid** dual-band mode: Measures connected band + estimates the other
- **Step-by-step** dual-band: Tests each band sequentially
- **Single band** mode for focused analysis

### 🌈 Professional Heatmap Visualization
- **4 heatmap layers**: Signal Strength, Link Speed (TX Rate), SNR, Noise Level
- **Band filtering**: All bands (hybrid), 2.4 GHz only, 5 GHz only
- Adjustable opacity with real-time preview
- IDW (Inverse Distance Weighting) interpolation for smooth coverage maps
- Color-coded spectrum: Cyan (excellent) → Green → Yellow → Orange → Red (poor)

### 📊 Spectrum Ruler
- Vertical color legend on the map showing signal quality ranges
- Left side: dBm values (-30 to -90)
- Right side: Estimated TX Rate (Mbps)
- Quality labels: Excellent, Good, Fair, Weak, Very Weak

### 🧠 AI Network Analysis
- **Overall network score** based on all measurements
- **Room-by-room WiFi status** with quality indicators
- **Channel interference detection**: 2.4 GHz overlap analysis, 5 GHz co-channel warnings
- **Dead zone detection**: Identifies areas with poor coverage
- **Speed bottleneck analysis**: Detects high-signal/low-speed anomalies
- **Smart recommendations** for optimal router placement
- **PDF export** of the full analysis report
- **Print support** for hardcopy reports

### 🔗 Mesh System Support
- Mark devices as Mesh System members (e.g., TP-Link Deco, Google Nest)
- Same-channel/SSID warnings automatically disabled for Mesh devices
- AI analysis recognizes and reports Mesh configurations

### 📤 Export Options
- **PNG** — Screenshot of the heatmap with floor plan
- **JSON** — Full project data for backup/transfer
- **CSV** — Measurement data for spreadsheet analysis
- **PDF** — AI analysis report
- **Print** — Direct browser printing

### 🌍 Multi-Language Support (i18n)
- **6 languages**: English, Türkçe, Español, Deutsch, Русский, 中文
- Language preference saved in localStorage
- All UI elements, tooltips, and AI reports are translated
- Dropdown selector in the header for instant switching

### 📱 Responsive Design
- Desktop-optimized layout with collapsible side panels
- Mobile-friendly floating toolbar for touch devices
- Device detection badge (Desktop / Tablet / Mobile)

---

## 🏗️ Architecture

WifiMapper uses **macOS-native WiFi scanning** via `system_profiler SPAirPortDataType` and a compiled Swift binary for real-time WiFi data. This is why **localhost is required for measurements**.

```
┌─────────────────────────────────────────┐
│           Browser (Frontend)            │
│  HTML5 Canvas · CSS3 · Vanilla JS       │
│  i18n · Heatmap Engine · AI Analysis    │
└──────────────┬──────────────────────────┘
               │ REST API (fetch)
┌──────────────▼──────────────────────────┐
│          Express Server (:3333)          │
│  /api/wifi/scan     → WiFi scan         │
│  /api/wifi/scan-all → All networks      │
│  /api/projects      → CRUD projects     │
└──────────────┬──────────────────────────┘
               │ child_process.exec
┌──────────────▼──────────────────────────┐
│         macOS System Layer              │
│  system_profiler SPAirPortDataType      │
│  wifi_scanner (Swift binary)            │
└─────────────────────────────────────────┘
```

### localhost vs Cloud Deployment

| Feature | localhost ✅ | Vercel/Cloud ❌ |
| :--- | :---: | :---: |
| WiFi measurement | ✅ | ❌ |
| Save projects | ✅ | ❌ |
| View heatmaps | ✅ | ✅ (read-only) |
| AI analysis | ✅ | ❌ |
| Export reports | ✅ | ❌ |

> **Why?** WiFi scanning requires macOS-native commands (`system_profiler`). Cloud platforms like Vercel cannot execute local system commands. Use localhost for all measurement work.

### Can I Use iPhone/iPad/Android?

**No, for measurements.** Mobile browsers cannot access WiFi signal data (dBm, TX Rate). You **must use a MacBook** for WiFi surveys. Mobile devices can only view existing heatmaps if served over the network.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/wifi/scan` | Current WiFi connection metrics |
| `GET` | `/api/wifi/scan-all` | All visible WiFi networks |
| `GET` | `/api/projects` | List all saved projects |
| `POST` | `/api/projects` | Create a new project |
| `PUT` | `/api/projects/:id` | Update project data |
| `DELETE` | `/api/projects/:id` | Delete a project |

---

## 📊 Measurement Accuracy: Why 5 Samples?

We analyzed 121 real-world measurements and found significant variance within 5-sample sets:

| Metric | Variance |
| :--- | :--- |
| **Signal (dBm)** | Avg 3.6 dBm range, max 10 dBm |
| ≥3 dBm difference | **64%** of measurements |
| ≥5 dBm difference | **27%** of measurements |
| **TX Rate (Mbps)** | Avg 90.1 Mbps range, max **693 Mbps** |
| ≥100 Mbps difference | **29%** of measurements |

> ⚠️ **Quick mode (1 sample)** is available for fast surveys but displays a prominent warning about potential inaccuracy.

---

## 🗂️ Project Structure

```
wifi-mapper/
├── server.js              # Express server + WiFi scan API
├── wifi_scanner.swift      # macOS native WiFi scanner (Swift)
├── wifi_scanner            # Compiled binary
├── package.json            # Dependencies
├── data/
│   ├── projects.json       # Active project data
│   └── demo-ornek-daire.json  # Demo project (121 measurements)
├── public/
│   ├── index.html          # Main application HTML
│   ├── css/
│   │   └── style.css       # Full stylesheet
│   └── js/
│       ├── i18n.js         # Internationalization (6 languages)
│       ├── app.js          # Main application logic
│       ├── floorplan.js    # Canvas & floor plan engine
│       ├── heatmap.js      # IDW heatmap rendering
│       ├── survey.js       # Measurement data management
│       ├── speedtest.js    # Speed test utilities
│       └── export.js       # PNG/JSON/CSV export
└── templates/              # Floor plan templates (coming soon)
    └── ornek-daire/           # sample apartment types
```

---

## 🆚 Comparison with Paid Tools

| Feature | WifiMapper | NetSpot ($49+) | Ekahau ($3,000+) |
| :--- | :---: | :---: | :---: |
| Signal heatmap | ✅ | ✅ | ✅ |
| SNR heatmap | ✅ | ✅ | ✅ |
| TX Rate heatmap | ✅ | ❌ | ✅ |
| Noise heatmap | ✅ | ✅ | ✅ |
| Floor plan support | ✅ | ✅ | ✅ |
| Room drawing | ✅ | ❌ | ✅ |
| AI analysis | ✅ | ❌ | ❌ |
| Mesh system support | ✅ | ❌ | ❌ |
| Multi-language (6) | ✅ | ❌ | ❌ |
| PDF report export | ✅ | ✅ (PRO) | ✅ |
| Predictive planning | ❌ | Basic | ✅ |
| Price | **Free** | **$49+** | **$3,000+** |

---

## 🏠 Floor Plan Templates

> 📂 **Coming soon:** Pre-built apartment floor plan templates for common layouts.

The `templates/` directory will contain ready-to-use floor plans:

```
templates/
└── ornek-daire/
    ├── 1+1.png        # Studio apartment
    ├── 2+1.png        # 2-bedroom
    ├── 3+1.png        # 3-bedroom
    └── 4+1.png        # 4-bedroom
```

---

## 🔌 Port Configuration

This project uses port **3333** (registered in `PORTS_REGISTRY.md`).

To change the port, edit the `PORT` variable in `server.js`:
```javascript
const PORT = 3333; // Change this
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — free for personal and commercial use.

---

<p align="center">
  <strong>Built with ❤️ for the WiFi community</strong><br>
  <sub>If you find this useful, please ⭐ the repository!</sub>
</p>
