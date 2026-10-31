# 📡 WifiMapper — WiFi Isı Haritası ve Analiz Aracı

> **Ücretsiz, açık kaynaklı, profesyonel düzeyde WiFi kapsama haritası oluşturma aracı — macOS için.**
> NetSpot ($49+) ve Ekahau ($3.000+) uygulamalarına güçlü bir alternatif.

🇬🇧 [English Documentation →](README_en.md)

---

## 🚀 Hızlı Başlangıç

```bash
# Projeyi kopyalayın
git clone https://github.com/niedy707/wifi-mapper.git

# Proje klasörüne gidin
cd wifi-mapper

# Bağımlılıkları yükleyin
npm install

# Sunucuyu başlatın
node server.js

# Tarayıcınızda açın
open http://localhost:3333
```

> 📋 **Yukarıdaki komutu kopyalayıp yapıştırın** — 30 saniyede hazır!

---

## ✨ Özellikler

### 🗺️ İnteraktif Kat Planı Haritalama
- Herhangi bir kat planı görselini (PNG, JPG, SVG) arka plan olarak yükleyin
- **Dikdörtgen** veya **serbest form çokgen** araçlarıyla oda çizin
- Duvar, metin notu ve özel çizimler ekleyin
- Fare/touchpad ile kaydırma, yakınlaştırma ve navigasyon
- Odalara çift tıklayarak isim verin veya silin

### 📡 Gerçek Zamanlı WiFi Ölçümü
- **5 saniyelik istatistiksel örnekleme** — 5 örnek alıp min/maks/ortalama hesaplar
- **Hızlı mod** (1 örneklem) — doğruluk uyarısı ile hızlı tarama
- Ölçülen değerler: Sinyal gücü (dBm), Gürültü tabanı, SNR, TX Rate, PHY Mode, Kanal, Bant
- **Akıllı Hibrit** çift bant modu: Bağlı bandı ölçer + diğerini tahmin eder
- **Adım Adım** çift bant: Her bandı sırayla test eder
- **Tek bant** modu: Odaklı analiz için

### 🌈 Profesyonel Heatmap Görselleştirme
- **4 heatmap katmanı**: Sinyal Gücü, Bağlantı Hızı (TX Rate), SNR, Gürültü Seviyesi
- **Bant filtreleme**: Tüm bantlar (hibrit), Sadece 2.4 GHz, Sadece 5 GHz
- Ayarlanabilir opaklık ile canlı önizleme
- IDW (Ters Mesafe Ağırlıklandırma) enterpolasyonu ile pürüzsüz kapsama haritaları
- Renk kodlaması: Cyan (mükemmel) → Yeşil → Sarı → Turuncu → Kırmızı (kötü)

### 📊 Spektrum Cetveli
- Haritanın sağ alt köşesinde dikey renk cetveli
- Sol taraf: dBm değerleri (-30 ile -90 arası)
- Sağ taraf: Tahmini TX Rate (Mbps)
- Kalite etiketleri: Mükemmel, İyi, Orta, Zayıf, Çok Zayıf

### 🧠 Yapay Zeka Ağ Analizi
- **Genel ağ skoru** — tüm ölçümlerin ortalamasına göre
- **Oda bazlı WiFi durumu** — kalite göstergeleri ile
- **Kanal çakışması tespiti**: 2.4 GHz çakışma analizi, 5 GHz ortak kanal uyarıları
- **Ölü bölge tespiti**: Kapsama dışı alanları belirler
- **Hız darboğaz analizi**: Yüksek sinyal / düşük hız anomalilerini tespit eder
- **Akıllı öneriler**: Optimal modem/AP yerleşimi için
- **PDF dışa aktarma** — tam analiz raporu
- **Yazdırma desteği** — basılı rapor için

### 🔗 Mesh Sistem Desteği
- Cihazları Mesh Sistem üyesi olarak işaretleyin (Örn: TP-Link Deco, Google Nest)
- Mesh cihazlar için aynı kanal/SSID uyarıları otomatik devre dışı
- AI analizi Mesh yapılandırmalarını tanır ve raporlar

### 📤 Dışa Aktarma Seçenekleri
- **PNG** — Kat planı üzerinde heatmap ekran görüntüsü
- **JSON** — Tam proje verisi (yedekleme/transfer)
- **CSV** — Ölçüm verisi (tablolama analizi)
- **PDF** — AI analiz raporu
- **Yazdır** — Doğrudan tarayıcıdan yazdırma

### 🌍 Çoklu Dil Desteği (i18n)
- **6 dil**: English, Türkçe, Español, Deutsch, Русский, 中文
- Dil tercihi localStorage'da saklanır
- Tüm arayüz elemanları, araç ipuçları ve AI raporları çevrilir
- Header'daki açılır menüden anında dil değiştirme

### 📱 Responsive Tasarım
- Masaüstü için optimize edilmiş — katlanabilir yan paneller
- Mobil uyumlu yüzen araç çubuğu (dokunmatik cihazlar)
- Cihaz algılama rozeti (Masaüstü / Tablet / Mobil)

---

## 🏗️ Mimari

WifiMapper, gerçek zamanlı WiFi verisi için `system_profiler SPAirPortDataType` ve derlenmiş bir Swift ikili dosyası kullanarak **macOS'a özgü WiFi taraması** yapar. Bu nedenle **ölçümler için localhost şarttır.**

```
┌─────────────────────────────────────────┐
│          Tarayıcı (Frontend)            │
│  HTML5 Canvas · CSS3 · Vanilla JS       │
│  i18n · Heatmap Motoru · AI Analizi     │
└──────────────┬──────────────────────────┘
               │ REST API (fetch)
┌──────────────▼──────────────────────────┐
│       Express Sunucu (:3333)            │
│  /api/wifi/scan     → WiFi tarama       │
│  /api/wifi/scan-all → Tüm ağlar        │
│  /api/projects      → CRUD projeler    │
└──────────────┬──────────────────────────┘
               │ child_process.exec
┌──────────────▼──────────────────────────┐
│         macOS Sistem Katmanı            │
│  system_profiler SPAirPortDataType      │
│  wifi_scanner (Swift ikili dosya)       │
└─────────────────────────────────────────┘
```

### localhost vs Bulut Dağıtımı

| Özellik | localhost ✅ | Vercel/Bulut ❌ |
| :--- | :---: | :---: |
| WiFi ölçümü | ✅ | ❌ |
| Proje kaydetme | ✅ | ❌ |
| Heatmap görüntüleme | ✅ | ✅ (salt okunur) |
| AI analiz | ✅ | ❌ |
| Rapor dışa aktarma | ✅ | ❌ |

> **Neden?** WiFi taraması, macOS'a özgü komutlar (`system_profiler`) gerektirir. Vercel gibi bulut platformları yerel sistem komutlarını çalıştıramaz. Tüm ölçüm çalışmaları için localhost kullanın.

### iPhone/iPad/Android Kullanabilir miyim?

**Ölçüm için hayır.** Mobil tarayıcılar WiFi sinyal bilgisine (dBm, TX Rate) erişemez. WiFi taraması için **MacBook kullanmanız şarttır.** Mobil cihazlar yalnızca mevcut heatmap'leri ağ üzerinden görüntüleyebilir.

---

## 📡 API Uç Noktaları

| Metod | Uç Nokta | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/wifi/scan` | Bağlı WiFi ağının anlık metrikleri |
| `GET` | `/api/wifi/scan-all` | Tüm görünür WiFi ağları |
| `GET` | `/api/projects` | Kayıtlı tüm projeleri listeler |
| `POST` | `/api/projects` | Yeni proje oluşturur |
| `PUT` | `/api/projects/:id` | Proje verilerini günceller |
| `DELETE` | `/api/projects/:id` | Projeyi siler |

---

## 📊 Ölçüm Doğruluğu: Neden 5 Örneklem?

121 gerçek dünya ölçümünü analiz ettik ve 5'li örneklem setlerinde önemli sapmalar bulduk:

| Metrik | Sapma |
| :--- | :--- |
| **Sinyal (dBm)** | Ort. 3.6 dBm aralık, maks. 10 dBm |
| ≥3 dBm fark | Ölçümlerin **%64'ünde** |
| ≥5 dBm fark | Ölçümlerin **%27'sinde** |
| **TX Rate (Mbps)** | Ort. 90.1 Mbps aralık, maks. **693 Mbps** |
| ≥100 Mbps fark | Ölçümlerin **%29'unda** |

> ⚠️ **Hızlı mod (1 örneklem)** hızlı taramalar için mevcuttur ancak olası hata hakkında belirgin bir uyarı gösterir.

---

## 🗂️ Proje Yapısı

```
wifi-mapper/
├── server.js              # Express sunucu + WiFi tarama API
├── wifi_scanner.swift      # macOS yerel WiFi tarayıcı (Swift)
├── wifi_scanner            # Derlenmiş ikili dosya
├── package.json            # Bağımlılıklar
├── data/
│   ├── projects.json       # Aktif proje verisi
│   └── demo-ornek-daire.json  # Demo proje (121 ölçüm)
├── public/
│   ├── index.html          # Ana uygulama HTML
│   ├── css/
│   │   └── style.css       # Tam stil dosyası
│   └── js/
│       ├── i18n.js         # Uluslararasılaştırma (6 dil)
│       ├── app.js          # Ana uygulama mantığı
│       ├── floorplan.js    # Canvas ve kat planı motoru
│       ├── heatmap.js      # IDW heatmap oluşturma
│       ├── survey.js       # Ölçüm verisi yönetimi
│       ├── speedtest.js    # Hız testi araçları
│       └── export.js       # PNG/JSON/CSV dışa aktarma
└── templates/              # Kat planı şablonları (yakında)
    └── ornek-daire/        # Örnek daire tipleri
```

---

## 🆚 Ücretli Araçlarla Karşılaştırma

| Özellik | WifiMapper | NetSpot ($49+) | Ekahau ($3.000+) |
| :--- | :---: | :---: | :---: |
| Sinyal heatmap | ✅ | ✅ | ✅ |
| SNR heatmap | ✅ | ✅ | ✅ |
| TX Rate heatmap | ✅ | ❌ | ✅ |
| Gürültü heatmap | ✅ | ✅ | ✅ |
| Kat planı desteği | ✅ | ✅ | ✅ |
| Oda çizimi | ✅ | ❌ | ✅ |
| AI analiz | ✅ | ❌ | ❌ |
| Mesh sistem desteği | ✅ | ❌ | ❌ |
| Çoklu dil (6) | ✅ | ❌ | ❌ |
| PDF rapor dışa aktarma | ✅ | ✅ (PRO) | ✅ |
| Tahmine dayalı planlama | ❌ | Temel | ✅ |
| Fiyat | **Ücretsiz** | **$49+** | **$3.000+** |

---

## 🏠 Kat Planı Şablonları

> 📂 **Yakında:** Yaygın daire tipleri için hazır kat planı şablonları eklenecek.

`templates/` dizini kullanıma hazır kat planlarını içerecek:

```
templates/
└── ornek-daire/
    ├── 1+1.png        # Stüdyo daire
    ├── 2+1.png        # 2 yatak odalı
    ├── 3+1.png        # 3 yatak odalı
    └── 4+1.png        # 4 yatak odalı
```

---

## 🔌 Port Yapılandırması

Bu proje **3333** portunu kullanır (`PORTS_REGISTRY.md` dosyasında kayıtlıdır).

Portu değiştirmek için `server.js` dosyasındaki `PORT` değişkenini düzenleyin:
```javascript
const PORT = 3333; // Bunu değiştirin
```

---

## 🤝 Katkıda Bulunma

1. Depoyu fork'layın
2. Bir özellik dalı oluşturun: `git checkout -b feature/harika-ozellik`
3. Değişikliklerinizi commit edin: `git commit -m 'Harika özellik eklendi'`
4. Dalı push edin: `git push origin feature/harika-ozellik`
5. Bir Pull Request açın

---

## 📄 Lisans

Bu proje MIT Lisansı ile lisanslanmıştır — kişisel ve ticari kullanım için ücretsizdir.

---

<p align="center">
  <strong>WiFi topluluğu için ❤️ ile yapılmıştır</strong><br>
  <sub>Faydalı bulduysanız, lütfen ⭐ verin!</sub>
</p>
