import CoreWLAN
import Foundation

let client = CWWiFiClient.shared()
guard let interface = client.interface() else {
    print("{\"error\": \"No WiFi interface found\"}")
    exit(1)
}

let ssid = interface.ssid() ?? "Bağlı Ağ"
let rssi = interface.rssiValue()
let noise = interface.noiseMeasurement()
let txRate = interface.transmitRate()

var phyModeStr = "Unknown"
switch interface.activePHYMode().rawValue {
case 1: phyModeStr = "802.11a"
case 2: phyModeStr = "802.11b"
case 3: phyModeStr = "802.11g"
case 4: phyModeStr = "802.11n"
case 5: phyModeStr = "802.11ac"
case 6: phyModeStr = "802.11ax"
default: phyModeStr = "Unknown"
}

var channel = 0
var band = "2.4GHz"
var width = 20

if let ch = interface.wlanChannel() {
    channel = ch.channelNumber
    if ch.channelBand == .band5GHz {
        band = "5GHz"
    } else if ch.channelBand == .band2GHz {
        band = "2.4GHz"
    }
    
    switch ch.channelWidth.rawValue {
    case 1: width = 20
    case 2: width = 40
    case 3: width = 80
    case 4: width = 160
    default: width = 20
    }
}

let json: [String: Any] = [
    "ssid": ssid.isEmpty ? "Bağlı Ağ" : ssid,
    "phyMode": phyModeStr,
    "channel": channel,
    "band": band,
    "channelWidth": width,
    "signal": rssi,
    "noise": noise,
    "snr": rssi - noise,
    "txRate": txRate,
    "networkType": "Infrastructure",
    "security": "WPA2 Personal"
]

if let jsonData = try? JSONSerialization.data(withJSONObject: json, options: []),
   let jsonString = String(data: jsonData, encoding: .utf8) {
    print(jsonString)
}
