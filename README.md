# 📱 Bose remote - Bluetooth Controller & Serial Terminal for Arduino Nano & HC-05

[![Live Demo](https://img.shields.io/badge/Live%20Demo-bluetooth--omega.vercel.app-blue?style=for-the-badge&logo=vercel)](https://bluetooth-omega.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

A modern, minimalist **Bose remote** IoT controller and Serial Bluetooth Terminal built with Next.js, TypeScript, and Tailwind CSS. Designed to wirelessly control dual LED channels connected to an **Arduino Nano** and an **HC-05 Bluetooth module** on battery power.

🌐 **Live Web Application:** [https://bluetooth-omega.vercel.app/](https://bluetooth-omega.vercel.app/)  
📂 **GitHub Repository:** [https://github.com/Pandi2352/bluetooth](https://github.com/Pandi2352/bluetooth)

---

## ✨ Features

- **🎮 Bose remote Industrial Design:**
  - **Tactile Physical Remote:** Minimalist Bose aesthetic, clean flat borders, zero shadows, consistent `rounded-md` radius across all components, and compact ergonomic spacing without wasted empty gaps.
  - **Serial Bluetooth Terminal:** Live serial console inspired by *Kai Morich's Serial Bluetooth Terminal* with TX/RX message logs, timestamps, ASCII / HEX toggle, autoscroll, configurable line endings (`None`, `\n`, `\r\n`, `\r`), command history navigation, and 4 quick-macro buttons (`M1: '1'`, `M2: '0'`, `M3: '2'`, `M4: '3'`).
- **🌓 Light & Dark Theme:**
  - **Default Light Mode:** Crisp, clean studio finish with pure flat surfaces.
  - **Dark Mode:** Deep carbon matte with subtle contrasting borders.
  - Seamless instant toggle with smooth CSS transitions.
- **⚡ Dual Independent Channels:**
  - **Channel 1 (Pin 2):** Command `'1'` = ON, `'0'` = OFF
  - **Channel 2 (Pin 3):** Command `'2'` = ON, `'3'` = OFF
  - **Master Controls:** "ALL ON" (`'1'` + `'2'`) and "ALL OFF" (`'0'` + `'3'`)
- **📡 Universal Bluetooth Connectivity:**
  - **Web Bluetooth API:** Native direct client-side BLE browser connection.
  - **Web Serial API:** Connect to paired Bluetooth SPP COM ports directly from Chrome/Edge without extra software.
  - **Next.js Backend Serial Bridge:** Node.js `serialport` bridge when running locally on PC.

---

## ⚡ Architecture Flow

```
[ Next.js Remote UI (https://bluetooth-omega.vercel.app) ]
              │
              ├───► Web Bluetooth / Web Serial API (Direct Client Connection)
              │
              └───► POST /api/led, /api/connect (Local Backend Serial Bridge)
                                │
                                ▼
                   [ HC-05 Bluetooth Module ]
                                │
                                │ UART Serial (TX/RX at 9600 Baud)
                                ▼
                     [ Arduino Nano (Battery) ]
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
     [ Pin 2: LED 1 ]                      [ Pin 3: LED 2 ]
```

---

## 🔌 Hardware Wiring & Pinout

### 1. Arduino Nano to HC-05 Bluetooth Module

| HC-05 Pin | Arduino Nano Pin | Description |
|---|---|---|
| **VCC** | **5V** | 5V Power Supply |
| **GND** | **GND** | Common Ground |
| **TXD** | **D10** (RX) | SoftwareSerial RX on Nano |
| **RXD** | **D11** (TX) | SoftwareSerial TX on Nano (*via voltage divider*) |
| **STATE** | Not Connected | Optional status LED |
| **EN / KEY** | Not Connected | Leave floating for transparent data mode |

> **⚠️ HC-05 RX 3.3V Voltage Divider (Recommended):**
> ```
> Arduino Nano D11 ───[ 1kΩ Resistor ]───┬─── HC-05 RXD
>                                        │
>                               [ 2kΩ Resistor ]
>                                        │
>                                       GND
> ```

### 2. Dual LED Channels

| LED | Anode (+ via 220Ω resistor) | Cathode (-) | Commands |
|---|---|---|---|
| **LED 1** | **Pin D2** | **GND** | `'1'` (ON) / `'0'` (OFF) |
| **LED 2** | **Pin D3** | **GND** | `'2'` (ON) / `'3'` (OFF) |

---

## 🤖 Arduino Firmware Code

This is the sketch running on the battery-powered Arduino Nano:

```cpp
#include <SoftwareSerial.h>

// SoftwareSerial(RX, TX) -> Pin 10 connects to HC-05 TX, Pin 11 connects to HC-05 RX
SoftwareSerial bluetooth(10, 11);

const int LED1 = 2; // Channel 1
const int LED2 = 3; // Channel 2

void setup() {
  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);

  // Initialize SoftwareSerial for HC-05 at standard 9600 baud
  bluetooth.begin(9600);
}

void loop() {
  if (bluetooth.available()) {
    char command = bluetooth.read();

    if (command == '1') {
      digitalWrite(LED1, HIGH); // LED 1 ON
    }
    else if (command == '0') {
      digitalWrite(LED1, LOW);  // LED 1 OFF
    }
    else if (command == '2') {
      digitalWrite(LED2, HIGH); // LED 2 ON
    }
    else if (command == '3') {
      digitalWrite(LED2, LOW);  // LED 2 OFF
    }
  }
}
```

---

## 🕹️ Command Reference

| Command Byte | Target | Action |
|:---:|:---:|:---|
| `'1'` | **LED 1 (Pin 2)** | Turn ON |
| `'0'` | **LED 1 (Pin 2)** | Turn OFF |
| `'2'` | **LED 2 (Pin 3)** | Turn ON |
| `'3'` | **LED 2 (Pin 3)** | Turn OFF |

---

## 📱 Mobile Connection Guide

The HC-05 is a **Bluetooth Classic (SPP/RFCOMM 2.0)** module.

### How to Connect & Control:

1. **Option A: Android Serial Bluetooth Terminal App (Recommended for Direct Mobile Testing)**
   - Pair your phone's Bluetooth with `HC-05` (PIN: `1234` or `0000`).
   - Open **Serial Bluetooth Terminal** by Kai Morich from Google Play Store.
   - Connect to HC-05 and send `1`, `0`, `2`, `3` to verify the LEDs instantly.

2. **Option B: Web Application (Desktop Chrome/Edge with Bluetooth)**
   - Pair HC-05 with Windows/Mac under Bluetooth Settings.
   - Open [https://bluetooth-omega.vercel.app/](https://bluetooth-omega.vercel.app/).
   - Click **Connect** and select the paired HC-05 serial port.
   - Use the tactile remote buttons or the Serial Console tab!

3. **Option C: Direct Mobile Web Bluetooth (BLE)**
   - If using a Bluetooth Low Energy module (such as **HM-10**, **AT-09**, or **ESP32**), mobile Chrome connects directly over Web Bluetooth via [https://bluetooth-omega.vercel.app/](https://bluetooth-omega.vercel.app/).

---

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/Pandi2352/bluetooth.git

# Navigate into project directory
cd bluetooth

# Install dependencies
npm install

# Start the Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

---

## 🏎️ 4WD RC Car Expansion & Circuit Diagrams

We have prepared complete engineering plans and interactive circuit diagrams for expanding into a full 4WD Smart RC Car powered by the Arduino Nano, L298N motor driver, and Bose remote:

- 📊 **Draw.io Complete Circuit Schematic:** [`docs/circuit_diagram.drawio`](./docs/circuit_diagram.drawio) *(Editable on [app.diagrams.net](https://app.diagrams.net))*
- ⚡ **Wire-by-Wire Assembly Checklist & Visual Schematic:** [`docs/CIRCUIT_GUIDE.md`](./docs/CIRCUIT_GUIDE.md)
- 🚀 **Full Project Architecture & Roadmap (Scratch to Advanced):** [`docs/RC_CAR_PLAN.md`](./docs/RC_CAR_PLAN.md)

---

## 📁 Repository Structure

```
bluetooth/
├── app/
│   ├── api/
│   │   ├── bluetooth/pair/   # Bluetooth pairing API route
│   │   ├── connect/          # Hardware port connect/disconnect route
│   │   ├── led/              # LED command sender route ('1', '0', '2', '3')
│   │   └── ports/            # Lists available COM / Bluetooth SPP ports
│   ├── globals.css           # Global Tailwind CSS styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Bose remote Dual Interface & Serial Terminal
├── docs/
│   ├── CIRCUIT_GUIDE.md      # Wire-by-wire connection checklist & Mermaid diagram
│   ├── RC_CAR_PLAN.md        # Complete RC car architecture & firmware roadmap
│   └── circuit_diagram.drawio # Complete Draw.io hardware circuit diagram
├── lib/
│   └── serialManager.ts      # Persistent Node.js serial port manager
├── scripts/
│   └── scan_bluetooth.ps1    # PowerShell script to scan Bluetooth devices on Windows
├── README.md                 # Complete documentation & live demo link
└── package.json              # Project dependencies & scripts
```

---

## 📄 License

MIT © [Pandi2352](https://github.com/Pandi2352)
