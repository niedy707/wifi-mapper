# 🛜 WifiMapper — macOS WiFi Sinyal ve Isı Haritası Oluşturma Aracı

WifiMapper, evinizde veya iş yerinizde WiFi kapsama alanını analiz etmek, sinyal kalitesini ölçmek ve görsel ısı haritaları (heatmap) oluşturmak için tasarlanmış **tamamen yerel ve açık kaynaklı** bir ağ analiz aracıdır. macOS işletim sistemine entegre `system_profiler` araçlarını kullanarak doğrudan donanım seviyesinde ölçüm yapar.

---

## 🚀 Öne Çıkan Özellikler

*   **⏱️ 5 Saniyelik Çoklu Örnekleme (Sampling):** Haritada tıkladığınız her noktada 5 saniye boyunca (saniyede 1 ölçüm) WiFi performansı analiz edilir. Bu sayede sadece anlık dalgalanmalar değil, bağlantının ortalama, minimum ve maksimum değerleri (Sinyal, SNR ve TX Rate) kaydedilir.
*   **📶 Akıllı Ölçüm Modları:**
    *   **Akıllı Hibrit (Smart Hybrid):** Tek bir tıklamayla hem 5 GHz hem de 2.4 GHz bantlarını tarar. Bağlı olduğunuz bandı analiz ederken arka planda çevre taraması ile diğer bandın sinyal gücünü tespit eder, TX Rate değerini tahmin eder ve her iki bandı tek seferde veri tabanına kaydeder.
    *   **Adım Adım (Step-by-Step):** 5 GHz ve 2.4 GHz ağlarınızı manuel olarak değiştirip ayrı ayrı ölçüm almanızı sağlar.
    *   **Tek Bant (Single Band):** Yalnızca o anda bağlı olduğunuz bant üzerinden ölçüm yapar.
*   **📊 Dinamik Isı Haritası Katmanları (Heatmap):**
    *   **Sinyal Gücü (Signal Strength):** Alıcı hassasiyetini (dBm cinsinden) görselleştirir.
    *   **Bağlantı Hızı (TX Rate / Transmit Rate):** Cihaz ile yönlendirici (router) arasındaki donanımsal anlaşma hızını (Mbps) gösterir. Geleneksel yerel hız testlerinin (localhost loopback) getirdiği yanıltıcı yüksek sonuçları aşarak en gerçekçi kablosuz bağlantı hızını haritalandırır.
    *   **Sinyal-Gürültü Oranı (SNR):** Arka plan gürültüsüne kıyasla sinyal kalitesini gösterir.
*   **🗺️ Görsel Kat Planı Desteği:** DWG veya JPG formatındaki kat planınızı yükleyebilir, ölçeklendirebilir ve harita üzerinde ölçüm noktalarını yerleştirebilirsiniz.
*   **🔒 Gizlilik Odaklı ve Yerel:** macOS Sequoia ve üzeri sürümlerdeki SSID gizleme (redacted) politikalarıyla uyumludur. Verileriniz tamamen kendi bilgisayarınızda (`projects.json`) saklanır, hiçbir harici sunucuya gönderilmez.
*   **📤 Rapor Dışa Aktarma:** Projeyi ölçümleriyle birlikte PDF raporu veya PNG resmi olarak dışa aktarabilirsiniz.

---

## 📁 Proje Yapısı

```text
wifi-mapper/
├── data/
│   └── projects.json          # Proje bilgilerini ve tüm ölçüm verilerini tutan dosya
├── public/
│   ├── css/                   # Arayüz tasarım stilleri (Vanilla CSS)
│   ├── js/
│   │   ├── app.js             # Ana uygulama akışı, ölçüm döngüsü (5s örnekleme)
│   │   ├── survey.js          # Ölçüm noktası yönetimi, detay paneli ve istatistikler
│   │   ├── heatmap.js         # Canvas tabanlı dinamik ısı haritası çizim motoru
│   │   ├── floorplan.js       # Kat planı yükleme, sürükleme ve ölçeklendirme
│   │   ├── speedtest.js       # (Opsiyonel) Yerel ağ hız testi fonksiyonları
│   │   └── export.js          # Rapor oluşturma ve dışa aktarma araçları
│   ├── index.html             # Modern, animasyonlu kullanıcı arayüzü (HTML5)
│   └── Örnek Daire plan...jpg    # Projede kullanılan aktif kat planı görseli
├── server.js                  # macOS system_profiler entegrasyonu sunan Express backend
├── load_floorplan.js          # Kat planını sisteme yükleyip projeyi başlatan script
├── clear_measurements.js      # Projedeki tüm ölçümleri sıfırlama aracı
├── package.json               # Node.js bağımlılıkları ve çalıştırma komutları
└── README.md                  # Bu belge
```

---

## 🛠️ Kurulum ve Çalıştırma

### Gereksinimler
*   **macOS** (Taramalar sistem araçlarına bağlı olduğundan yalnızca macOS üzerinde çalışır)
*   **Node.js** (v16 veya daha yeni bir sürüm)

### 1. Bağımlılıkları Yükleyin
Proje klasörüne gidin ve gerekli paketleri kurun:
```bash
npm install
```

### 2. Uygulamayı Başlatın
Geliştirici modunda sunucuyu çalıştırın:
```bash
npm run dev
# ya da
npm start
```
Sunucu varsayılan olarak **`http://localhost:3333`** adresinde çalışmaya başlayacaktır.

---

## 🧹 Verileri Sıfırlama ve Yeniden Başlatma

Mevcut projede yapılan tüm ölçümleri sıfırlamak ve baştan temiz bir ölçüm yapmak için aşağıdaki adımları uygulayabilirsiniz:

### 1. Ölçümleri Sıfırlama Scripti
Terminalde proje klasöründeyken şu komutu çalıştırarak "Örnek Daire Ölçümü" altındaki tüm ölçüm noktalarını silebilirsiniz:
```bash
node clear_measurements.js
```
*Bu komut `data/projects.json` dosyasını günceller. Backend sunucusu dosyayı her istekte dinamik okuduğu için sunucuyu kapatıp açmanıza gerek yoktur; tarayıcıyı yenilemeniz yeterlidir.*

### 2. Kat Planını Yeniden Yükleme
Eğer kat planını sıfırdan sisteme yüklemek ve yeni bir proje girdisi oluşturmak isterseniz:
```bash
node load_floorplan.js
```

---

## 📶 Ölçüm Detayları ve Hesaplama Mantığı

### 5 Saniyelik Örnekleme Nedir?
Geleneksel WiFi analiz araçları sadece tek bir anlık sinyal seviyesine bakar. WifiMapper ise tıkladığınız noktada:
1. Saniyede 1 adet olmak üzere 5 kez üst üste `system_profiler SPAirPortDataType` komutunu çalıştırır.
2. Bu 5 ölçümün **Ortalama (Average)**, **En Düşük (Min)** ve **En Yüksek (Max)** değerlerini hesaplar.
3. Böylece ortamdaki anlık dalgalanmalardan (insan hareketi, parazitler vb.) etkilenmeyen, sağlıklı ve tutarlı bir harita elde edilir.

### Neden TX Rate (Gönderim Hızı)?
Geleneksel hız testi araçları internet üzerinden (Speedtest.net gibi) veya yerel ağdaki sunucuya veri indirip/yükleyerek çalışır. Ancak localhost üzerinden yapılan testler gerçek WiFi hızını değil, 3000+ Mbps gibi sanal loopback hızlarını ölçer. 
WifiMapper, doğrudan kablosuz ağ kartınızın erişim noktası (access point) ile anlaştığı **Transmit Rate (Link Speed)** değerini okur. Bu değer, kablosuz bağlantınızın donanımsal olarak desteklediği gerçek üst sınırı (Mbps) temsil eder.

---

## 📡 API Uç Noktaları (Endpoints)

*   `GET /api/wifi/scan`: Bağlı olunan WiFi ağının anlık performans verilerini (Sinyal, Gürültü, SNR, Kanal, Band, TX Rate, PHY Mode) döndürür.
*   `GET /api/wifi/scan-all`: Çevredeki tüm görünür WiFi ağlarını listeler.
*   `GET /api/projects`: Kayıtlı tüm projeleri listeler.
*   `POST /api/projects`: Yeni bir proje oluşturur.
*   `PUT /api/projects/:id`: Proje verilerini (ölçek, harita çizimleri, ölçüm noktaları) günceller.
*   `DELETE /api/projects/:id`: Belirtilen projeyi siler.

---

## 🏗️ Mimari: localhost vs Vercel

WifiMapper **macOS'a özel native framework** kullanarak WiFi taraması yapar. Bu nedenle **ölçüm yapılabilmesi için yerel sunucu (localhost) şarttır.**

```
localhost:3333 (MacBook)                    wifimapper.vercel.app
├── Frontend (HTML/CSS/JS)  ✅              ├── Frontend (HTML/CSS/JS)  ✅
├── WiFi Tarama API         ✅ ← macOS      ├── WiFi Tarama API         ❌
├── Hız Testi API           ✅              ├── Hız Testi API           ❌
└── Veri Kaydetme           ✅              └── Veri Kaydetme           ❌
```

### Neden Vercel'de Ölçüm Yapılamaz?
WiFi tarama, macOS'un `system_profiler SPAirPortDataType` komutunu çalıştıran bir native binary gerektirir. Vercel bir serverless platformdur ve macOS komutları çalıştıramaz. Bu nedenle:

| Özellik | localhost ✅ | Vercel ❌ |
| :--- | :---: | :---: |
| WiFi ölçümü yapma | ✅ | ❌ |
| Proje kaydetme | ✅ | ❌ |
| Harita görüntüleme | ✅ | ✅ (salt okunur) |
| AI analiz raporu | ✅ | ❌ (veri yok) |

### Aynı Kısıtlar Tablet/Telefon İçin de Geçerli mi?
**Evet.** iPhone, iPad ve Android cihazlardaki web tarayıcıları WiFi sinyal bilgisine (dBm, Tx Rate) erişemez. Ölçüm yapmak için **macOS + localhost** şarttır.

> 💡 **Tavsiye:** Vercel dağıtımını yalnızca bitmiş raporu/haritayı başkalarıyla paylaşmak için kullanın. Aktif ölçüm ve analiz için her zaman `localhost:3333` üzerinden çalışın.

---

## 🏠 Oda Yönetimi

*   **Dikdörtgen Çiz:** Sol araç çubuğundan dikdörtgen oda çizin.
*   **Köşeleri Belirle:** Serbest formda çokgen oda oluşturun (noktalarla).
*   **Çift tıklama menüsü:** Var olan bir odaya çift tıklayarak isim verin veya silin.
*   **Tüm Odaları Sil:** Sol paneldeki buton ile tüm oda çizimlerini tek seferde temizleyin.
*   **Görünürlük:** "Odaları Göster" toggle'ı ile oda çizimlerini gizleyin/gösterin.

---

## 🔗 Mesh Sistem Desteği

Modem/AP eklerken "Mesh Sistem Cihazı" olarak işaretleyebilirsiniz. Bu sayede:
*   Aynı SSID ve kanal kullanan mesh cihazlar arasında **kanal çakışması uyarısı verilmez**.
*   AI analizinde mesh sistemler otomatik olarak tanınır ve raporlanır.

---

## 📊 AI Analiz Raporu

"🧠 Yapay Zeka" bölümünden başlatabileceğiniz analiz şunları içerir:
*   **Genel skor:** Tüm ölçümlerin ortalamasına göre (Mükemmel/İyi/Orta/Zayıf/Kötü).
*   **Oda bazlı WiFi durumu:** Her odadaki ölçüm sayısı, ortalama sinyal ve kalite kartı.
*   **Kanal çakışması tespiti:** 2.4 GHz ve 5 GHz bantlarında kanal çakışma uyarıları.
*   **Kapsama alanı analizi:** Zayıf sinyal noktaları ve ölü bölge tespiti.
*   **Mesh sistem bilgisi:** Mesh cihazlar için çakışma uyarıları devre dışı bırakılır.

---

## 🌈 Spektrum Cetveli

Haritanın sağ alt köşesinde dikey bir spektrum cetveli gösterilir:
*   **Sol taraf:** dBm değerleri (-30 ile -90 arası)
*   **Sağ taraf:** Tahmini Tx Rate (Mbps)
*   **Renk kodu:** Cyan/yeşil (mükemmel) → kırmızı (çok zayıf)
*   **Kalite etiketleri:** Mükemmel, İyi, Orta, Zayıf, Çok Zayıf

---

## 🔌 Port Bilgisi

Bu proje **`PORTS_REGISTRY.md`** dosyasında kayıtlıdır:

| Proje | Port | Tür |
| :--- | :---: | :--- |
| **wifi-mapper** | `3333` | Express |

Port değiştirmek için `server.js` dosyasındaki `PORT` değişkenini güncelleyin.
