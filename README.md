# 🏎️ Bose remote - 4WD RC Car Bluetooth Controller & Serial Terminal

[![Live Demo](https://img.shields.io/badge/Live%20Demo-bluetooth--omega.vercel.app-blue?style=for-the-badge&logo=vercel)](https://bluetooth-omega.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

A modern, tactile **Bose remote** IoT controller and Serial Bluetooth Terminal built with Next.js, TypeScript, and Tailwind CSS. Designed specifically to wirelessly control a **4WD RC Car with 4 DC Motors**, powered by **2x 18650 Li-ion batteries (7.4V)**, **L298N dual H-bridge motor driver**, **buck converter (5V)**, and an **Arduino Uno (or Nano)** with an **HC-05 Bluetooth module**.

🌐 **Live Web Application:** [https://bluetooth-omega.vercel.app/](https://bluetooth-omega.vercel.app/)  
📂 **GitHub Repository:** [https://github.com/Pandi2352/bluetooth](https://github.com/Pandi2352/bluetooth)  
📁 **Full Circuit Diagram:** [`docs/circuit_diagram.drawio`](./docs/circuit_diagram.drawio)  
📖 **Hardware Wiring Guide:** [`docs/CIRCUIT_GUIDE.md`](./docs/CIRCUIT_GUIDE.md)  
🤖 **Arduino Uno Firmware:** [`docs/arduino_rc_car_uno_bt.ino`](./docs/arduino_rc_car_uno_bt.ino)  

---

## ✨ Features

- **🎮 Bose remote Industrial Design:**
  - **Tactile Physical Remote:** Minimalist Bose aesthetic, clean flat borders, zero shadows, consistent `rounded-md` radius across all components, and compact ergonomic spacing without wasted empty gaps.
  - **Pure 4-Motor Control Pad:** Dedicated large buttons for Forward (`F`), Reverse (`B`), Left (`L`), Right (`R`), Spin Left, Spin Right, and Emergency Brake (`S`).
  - **Drive Modes:**
    - **● Tap to Drive (Latching):** Tap Forward to move continuously; tap Stop to halt.
    - **Hold to Drive (Momentary):** Press and hold to drive; releasing the button auto-stops.
  - **Keyboard Driving:** Full `W`, `A`, `S`, `D`, Arrow keys, and `Space` (Brake) support.
  - **Bluetooth Write Mutex Queue:** Zero GATT collisions (`NetworkError: GATT operation already in progress` resolved). Every click and press is dispatched sequentially.
- **📟 Serial Bluetooth Terminal:**
  - Live serial console inspired by *Kai Morich's Serial Bluetooth Terminal* with TX/RX message logs, timestamps, ASCII / HEX toggle, autoscroll, configurable line endings (`None`, `\n`, `\r\n`, `\r`), command history navigation, and quick RC macros (`Fwd`, `Back`, `Left`, `Right`, `Stop`).
- **🌓 Light & Dark Theme:**
  - **Default Light Mode:** Crisp, clean studio finish with pure flat surfaces.
  - **Dark Mode:** Deep carbon matte with subtle contrasting borders.
- **📡 Universal Bluetooth Connectivity:**
  - **Web Bluetooth API:** Native direct client-side BLE browser connection (Mobile Chrome & Android).
  - **Web Serial API:** Connect to paired Bluetooth SPP COM ports directly from Chrome/Edge without extra software.
  - **Next.js Backend Serial Bridge:** Node.js `serialport` bridge when running locally on PC.

---

## ⚡ Architecture Flow

```
[ Next.js Bose Remote UI (https://bluetooth-omega.vercel.app) ]
              │
              ├───► Web Bluetooth / Web Serial API (Direct Browser Connection)
              │
              └───► POST /api/led, /api/connect (Local Backend Serial Bridge)
                                │
                                ▼
                   [ HC-05 Bluetooth Module ]
                                │
                                │ UART Serial (TX/RX at 9600 Baud)
                                ▼
                     [ Arduino Uno / Nano ]
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                                             ▼
  [ IN1, IN2 (D7, D8) ]                         [ IN3, IN4 (D9, D10) ]
         │                                             │
         └──────────────────────┬──────────────────────┘
                                ▼
                   [ L298N Dual H-Bridge Driver ]
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
 [ OUT 1 & OUT 2 (2 Left Motors) ]   [ OUT 3 & OUT 4 (2 Right Motors) ]
```

---

## 🔌 Hardware Wiring & Pinout

### 1. Power Distribution (2S Li-ion 7.4V)

| From Component | Pin / Terminal | To Component | Pin / Terminal | Notes |
|---|---|---|---|---|
| **2x 18650 Battery (+)** | Positive Lead (7.4V) | **2A Power Switch** | Input terminal | High current supply |
| **2A Power Switch** | Output terminal | **L298N Driver** | **+12V Screw Terminal** | Motor high-voltage rail |
| **2A Power Switch** | Output terminal | **Buck Converter** | **IN (+) Terminal** | Input to 5V regulator |
| **18650 Battery (-)** | Negative Lead | **Common GND Rail** | GND | Star Ground |
| **Buck Converter** | **OUT (+) (5.0V)** | **L298N Driver** | **+5V Screw Terminal** | **REMOVE 5V-EN JUMPER!** |
| **Buck Converter** | **OUT (+) (5.0V)** | **Arduino Uno** | **5V Pin** | Clean logic supply |
| **Buck Converter** | **OUT (+) (5.0V)** | **HC-05 Bluetooth** | **VCC Pin** | Clean logic supply |

### 2. Motor Driver Logic (L298N to Arduino Uno)

| L298N Pin | Function | Arduino Pin | Notes |
|:---:|---|:---:|---|
| **ENA** | Left Motors Speed | **JUMPER ON** | Full Speed |
| **IN1** | Left Motors Forward | **Pin D7** | Skid steering |
| **IN2** | Left Motors Reverse | **Pin D8** | Skid steering |
| **IN3** | Right Motors Forward | **Pin D9** | Skid steering |
| **IN4** | Right Motors Reverse | **Pin D10** | Skid steering |
| **ENB** | Right Motors Speed | **JUMPER ON** | Full Speed |
| **5V-EN** | 5V Regulator Jumper | **REMOVE JUMPER!** | Power from buck converter |

### 3. HC-05 Bluetooth Serial (with 3.3V Logic Divider)

| HC-05 Pin | Arduino Uno Pin | Voltage Level | Notes |
|:---:|:---:|:---:|---|
| **VCC** | **Buck 5.0V** | 5V | Powers module |
| **GND** | **Common GND** | 0V | Ground return |
| **TXD** | **Pin D3 (RX)** | 3.3V Logic | Connected directly to Arduino D3 |
| **RXD** | **Pin D4 (TX)** | **3.3V Logic** | **Via 1kΩ / 2kΩ divider from Arduino D4** |

---

## 🕹️ Driving Commands Reference

| Key / Button | Action | Command Byte | Description |
|:---:|:---:|:---:|:---|
| **W / ▲** | **Forward** | `'F'` | All 4 wheels drive forward (`IN1=1, IN2=0, IN3=1, IN4=0`) |
| **S / ▼** | **Reverse** | `'B'` | All 4 wheels drive in reverse (`IN1=0, IN2=1, IN3=0, IN4=1`) |
| **A / ◄** | **Turn Left** | `'L'` | Left wheels reverse, Right wheels forward (`IN1=0, IN2=1, IN3=1, IN4=0`) |
| **D / ►** | **Turn Right** | `'R'` | Left wheels forward, Right wheels reverse (`IN1=1, IN2=0, IN3=0, IN4=1`) |
| **Space / 🛑** | **Brake / Stop** | `'S'` | Electronic dynamic brake (`IN1=0, IN2=0, IN3=0, IN4=0`) |

---

## 🤖 Arduino Firmware Code

The complete sketch is located at [`docs/arduino_rc_car_uno_bt.ino`](./docs/arduino_rc_car_uno_bt.ino).

```cpp
#include <SoftwareSerial.h>

SoftwareSerial bt(3, 4); // RX = D3, TX = D4

#define IN1 7
#define IN2 8
#define IN3 9
#define IN4 10

unsigned long lastCmdTime = 0;
const unsigned long SAFETY_TIMEOUT_MS = 2500; // 2.5s safe watchdog
bool isMoving = false;

void drive(bool l1, bool l2, bool r1, bool r2) {
  digitalWrite(IN1, l1);
  digitalWrite(IN2, l2);
  digitalWrite(IN3, r1);
  digitalWrite(IN4, r2);
  isMoving = (l1 || l2 || r1 || r2);
}

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  bt.begin(9600);
  Serial.begin(9600);
  drive(0, 0, 0, 0);
  lastCmdTime = millis();
}

void loop() {
  while (bt.available()) {
    char c = bt.read();
    lastCmdTime = millis();

    switch (c) {
      case 'F': drive(1, 0, 1, 0); bt.println(F("MOTORS: FWD")); break;
      case 'B': drive(0, 1, 0, 1); bt.println(F("MOTORS: REV")); break;
      case 'L': drive(0, 1, 1, 0); bt.println(F("MOTORS: LEFT")); break;
      case 'R': drive(1, 0, 0, 1); bt.println(F("MOTORS: RIGHT")); break;
      case 'S': drive(0, 0, 0, 0); bt.println(F("MOTORS: STOP")); break;
    }
  }

  // Failsafe auto-brake if Bluetooth signal lost
  if (isMoving && (millis() - lastCmdTime > SAFETY_TIMEOUT_MS)) {
    drive(0, 0, 0, 0);
    bt.println(F("WATCHDOG: SAFE STOP"));
  }
}
```

---

## 🛠️ Local Development & Running

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Dev Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Build Production Bundle:**
   ```bash
   npm run build
   ```

---

## 📄 License

MIT License. Designed with ❤️ for IoT, Robotics, and Maker communities.
