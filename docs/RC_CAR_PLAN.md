# 🏎️ 4WD RC Car Project: Complete Architecture & Implementation Plan
### *Arduino Nano • L298N Motor Driver • HC-05 Bluetooth • Bose Remote Web Control*

---

## 📋 Document Overview

This blueprint provides an end-to-end engineering roadmap for building, wiring, programming, and expanding a **4-Wheel Drive (4WD) Smart RC Car** powered by an **Arduino Nano** and an **L298N Dual H-Bridge Motor Driver**, communicating wirelessly over Bluetooth with the **Bose remote** web application ([https://bluetooth-omega.vercel.app/](https://bluetooth-omega.vercel.app/)).

The project scales systematically from **Phase 1 (Basic Differential Drive & Dual Lights)** all the way to **Phase 5 (Autonomous Navigation, Sensor Fusion & FPV Streaming)**.

> 📊 **Circuit Schematics & Firmware:**
> - 📁 **Draw.io Schematic File:** [`docs/circuit_diagram.drawio`](./circuit_diagram.drawio) *(Open with [app.diagrams.net](https://app.diagrams.net))*
> - 📄 **Visual Wiring Guide & Checklist:** [`docs/CIRCUIT_GUIDE.md`](./CIRCUIT_GUIDE.md)
> - 🤖 **Complete Arduino Nano Code:** [`docs/arduino_nano_rc_car.ino`](./arduino_nano_rc_car.ino)

---

## 📑 Table of Contents

1. [System Architecture Flow](#1-system-architecture-flow)
2. [Hardware Bill of Materials (BOM)](#2-hardware-bill-of-materials-bom)
3. [Pinout Allocation Matrix (Arduino Nano)](#3-pinout-allocation-matrix-arduino-nano)
4. [Power Distribution & Grounding Strategy](#4-power-distribution--grounding-strategy)
5. [Motor Kinematics & Differential Drive](#5-motor-kinematics--differential-drive)
6. [Serial Communication & Command Protocol](#6-serial-communication--command-protocol)
7. [Arduino Nano Firmware Architecture](#7-arduino-nano-firmware-architecture)
8. [Bose Remote UI Evolution Roadmap](#8-bose-remote-ui-evolution-roadmap)
9. [Step-by-Step Multi-Phase Development Roadmap](#9-step-by-step-multi-phase-development-roadmap)
10. [Safety, Fail-safes & Noise Suppression](#10-safety-fail-safes--noise-suppression)
11. [Troubleshooting & Debugging Guide](#11-troubleshooting--debugging-guide)

---

## 1. System Architecture Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        "Bose remote" Web App                           │
│                 (https://bluetooth-omega.vercel.app)                   │
│   • Tactile D-Pad / Motion Controls                                   │
│   • Dual Headlight Controls (Channel 1: D2, Channel 2: D3)             │
│   • Speed PWM Slider & Macros                                          │
│   • Live Serial Bluetooth Terminal Console                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ Wireless Bluetooth 2.4 GHz (SPP / BLE)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        HC-05 Bluetooth Module                          │
│                   (Configured at 9600 Baud Rate)                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ UART Serial (TX -> D10, RX <- D11)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             Arduino Nano                               │
│                         (ATmega328P 16MHz)                             │
│   • Packet Parser & Non-blocking State Machine                         │
│   • Failsafe Watchdog (Auto-Brake on signal drop)                      │
│   • Dual Headlight Digital Drivers (Pins D2 & D3)                      │
│   • PWM & Direction Signal Generation for L298N                        │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
     Digital Logic (D2, D3)             PWM & Direction (D4, D5, D6, D7, D8, D12)
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐      ┌───────────────────────────────┐
       │   Dual LED Headlights  │      │       L298N Motor Driver      │
       │   • Light 1: Pin D2    │      │  • Dual H-Bridge (Up to 2A/ch)│
       │   • Light 2: Pin D3    │      │  • ENA / ENB Speed Control    │
       └────────────────────────┘      └──────────────┬────────────────┘
                                                      │
                                                      │ High-Current DC Drive
                                                      ▼
                                       ┌───────────────────────────────┐
                                       │    4x DC TT Gear Motors       │
                                       │  • Left Pair (Front & Rear)   │
                                       │  • Right Pair (Front & Rear)  │
                                       └───────────────────────────────┘
```

---

## 2. Hardware Bill of Materials (BOM)

### Core Electronics

| Component | Quantity | Purpose / Specification |
|---|:---:|---|
| **Arduino Nano** | 1 | Microcontroller (ATmega328P, 5V, 16 MHz, Mini-USB or Type-C). |
| **L298N Motor Driver** | 1 | Dual H-bridge driver module (handles 5V–35V, 2A peak per channel). |
| **HC-05 Bluetooth Module** | 1 | Bluetooth 2.0 Classic SPP wireless receiver (configured for 9600 baud). |
| **TT DC Gear Motors** | 4 | 3V–6V DC motors with 1:48 reduction gearbox (approx. 200 RPM at 6V). |
| **Rubber Robot Wheels** | 4 | 65mm diameter rubber grip wheels compatible with TT motor shafts. |
| **4WD Robot Chassis Plate** | 1 | Acrylic or aluminum multi-tier chassis kit with mounting hardware. |
| **High-Brightness LEDs** | 2 | 5mm White / Amber LEDs for dual headlights. |
| **Resistors (220Ω)** | 2 | Current-limiting resistors for LEDs. |
| **Resistors (1kΩ & 2kΩ)** | 1 each | Voltage divider on HC-05 RX pin (steps 5V logic down to 3.3V). |

### Power Supply & Infrastructure

| Component | Quantity | Purpose / Specification |
|---|:---:|---|
| **18650 Li-ion Batteries** | 2 or 3 | High-drain rechargeable cells (2S = 7.4V nominal / 3S = 11.1V nominal). |
| **18650 Battery Holder** | 1 | 2-cell or 3-cell holder with lead wires. |
| **SPST Toggle / Rocker Switch** | 1 | Master power ON/OFF switch. |
| **Capacitors (100nF / 0.1µF)** | 4 | Ceramic disc noise suppression capacitors (soldered across motor terminals). |
| **Jumper Wires (M-M, M-F, F-F)** | 30+ | Multi-color 20cm hookup wires for breadboard / direct wiring. |
| **Mini Breadboard / Perfboard** | 1 | Clean distribution of common 5V and GND rails. |

---

## 3. Pinout Allocation Matrix (Arduino Nano)

To avoid hardware timer conflicts and preserve pins for future expansions (ultrasonic sensors, servos, telemetry), pins are allocated as follows:

| Arduino Nano Pin | Connected Device | Function | Mode | Notes |
|---|---|---|:---:|---|
| **D2** | **Light 1 (Left Headlight)** | Channel 1 LED | Digital Output | Matches existing remote command `'1'`/`'0'` |
| **D3** | **Light 2 (Right Headlight)** | Channel 2 LED | Digital Output | Matches existing remote command `'2'`/`'3'` |
| **D4** | **L298N IN1** | Left Motors Direction 1 | Digital Output | High = Forward |
| **D5** | **L298N ENA** | Left Motors Speed | **PWM Output** | 8-bit Timer0 PWM (0–255 speed) |
| **D6** | **L298N ENB** | Right Motors Speed | **PWM Output** | 8-bit Timer0 PWM (0–255 speed) |
| **D7** | **L298N IN2** | Left Motors Direction 2 | Digital Output | High = Reverse |
| **D8** | **L298N IN3** | Right Motors Direction 1 | Digital Output | High = Forward |
| **D12** | **L298N IN4** | Right Motors Direction 2 | Digital Output | High = Reverse |
| **D10** | **HC-05 TXD** | SoftwareSerial RX | Digital Input | Receives bytes from Bluetooth |
| **D11** | **HC-05 RXD** | SoftwareSerial TX | Digital Output | Sends bytes via 1k/2k voltage divider |
| **A0** *(Reserved)* | Battery Voltage Divider | Voltage Telemetry | Analog Input | 10k/2.2k divider monitors battery level |
| **A4 (SDA)** *(Reserved)* | MPU-6050 / OLED Display | I2C Data | I2C Bus | Future Gyro/IMU or mini screen |
| **A5 (SCL)** *(Reserved)* | MPU-6050 / OLED Display | I2C Clock | I2C Bus | Future Gyro/IMU or mini screen |
| **D9** *(Reserved)* | HC-SR04 Echo / Servo | Obstacle Avoidance | PWM / Digital | Future ultrasonic sensor servo pan |

---

## 4. Power Distribution & Grounding Strategy

> [!CAUTION]
> **Brownout Prevention Rule:** NEVER power the 4 DC motors directly from the Arduino Nano's 5V pin! When DC motors start or stall, they draw up to 1.5A–2.0A, which instantly causes the Arduino to brown out, reboot, or permanently damage its onboard voltage regulator.

```
       [ 7.4V - 11.1V Li-ion Battery Pack ]
                         │
                    [ ON/OFF Switch ]
                         │
       ┌─────────────────┴─────────────────┐
       │ (+) Motor Power Rail              │ (-) Ground Rail
       ▼                                   ▼
┌──────────────────┐               ┌──────────────────┐
│ L298N 12V Input  │               │ L298N GND        │
│ • Powers H-Bridge│               │                  │
└─────────┬────────┘               └─────────┬────────┘
          │                                  │
   [Onboard 5V Reg]                          │
          │ 5V Clean Logic                   │
          ├─────────────────────┐            │
          ▼                     ▼            │
┌──────────────────┐  ┌──────────────────┐   │
│ Arduino Nano 5V  │  │ HC-05 VCC (5V)   │   │
└─────────┬────────┘  └─────────┬────────┘   │
          │                     │            │
          ▼                     ▼            ▼
     [Nano GND] ────────── [HC-05 GND] ─── COMMON GND BUS
```

### Key Power Rules:
1. **Common Ground:** The Battery negative, L298N GND, Arduino Nano GND, and HC-05 GND must all be tied together into a single common ground bus.
2. **5V Logic Rail:**
   - If using a 2S Li-ion battery (7.4V–8.4V), the L298N's built-in 5V regulator jumper can remain **ON**. Its 5V terminal will output clean 5V to power the Arduino Nano (via the 5V pin) and the HC-05 module.
   - If using a 3S Li-ion battery (>12V), remove the L298N 5V jumper and use a dedicated **LM2596 buck converter** to step down battery voltage to 5.0V for logic.
3. **HC-05 3.3V Logic Protection:**
   - The HC-05 RXD pin accepts 3.3V. While its VCC is 5V, connecting Arduino Nano D11 (5V output) directly to HC-05 RXD can degrade the module over time.
   - Use a simple voltage divider: D11 $\rightarrow$ 1kΩ $\rightarrow$ HC-05 RXD $\rightarrow$ 2kΩ $\rightarrow$ GND.

---

## 5. Motor Kinematics & Differential Drive

A 4WD chassis uses **skid-steering (differential drive)**, similar to a tank. Each side's front and rear motors are wired in parallel to the respective L298N output channel:

- **Left Pair (Front-Left + Rear-Left):** Connected to L298N `OUT1` & `OUT2`.
- **Right Pair (Front-Right + Rear-Right):** Connected to L298N `OUT3` & `OUT4`.

### Direction Truth Table

| Maneuver | IN1 (D4) | IN2 (D7) | IN3 (D8) | IN4 (D12) | ENA (D5) | ENB (D6) | Description |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **Forward** | HIGH | LOW | HIGH | LOW | Speed | Speed | All 4 wheels spin forward |
| **Reverse** | LOW | HIGH | LOW | HIGH | Speed | Speed | All 4 wheels spin backward |
| **Spin Left** | LOW | HIGH | HIGH | LOW | Speed | Speed | Left wheels reverse, Right forward (Sharp pivot) |
| **Spin Right** | HIGH | LOW | LOW | HIGH | Speed | Speed | Left wheels forward, Right reverse (Sharp pivot) |
| **Gentle Left** | HIGH | LOW | HIGH | LOW | Speed/2 | Speed | Left wheels slower, Right wheels full speed |
| **Gentle Right**| HIGH | LOW | HIGH | LOW | Speed | Speed/2 | Left wheels full speed, Right wheels slower |
| **Hard Stop** | LOW | LOW | LOW | LOW | 0 | 0 | Dynamic electronic braking |
| **Coast Stop** | Any | Any | Any | Any | 0 | 0 | Motors freewheel to a halt |

---

## 6. Serial Communication & Command Protocol

The command protocol maintains full backwards compatibility with the current **Bose remote** LED buttons while introducing standard RC vehicle movement commands.

### Protocol Command Map

| Command | Action Category | Target / Description |
|:---:|:---|:---|
| `'F'` | Motion | Drive Forward |
| `'B'` | Motion | Drive Backward |
| `'L'` | Motion | Steer / Spin Left |
| `'R'` | Motion | Steer / Spin Right |
| `'S'` | Motion | Stop / Neutral Brake |
| `'G'` | Motion | Forward Diagonal Left (Gentle turn) |
| `'I'` | Motion | Forward Diagonal Right (Gentle turn) |
| `'H'` | Motion | Backward Diagonal Left |
| `'J'` | Motion | Backward Diagonal Right |
| `'1'` | Lighting | **Turn ON Light 1 (Pin D2)** *(Existing Bose remote)* |
| `'0'` | Lighting | **Turn OFF Light 1 (Pin D2)** *(Existing Bose remote)* |
| `'2'` | Lighting | **Turn ON Light 2 (Pin D3)** *(Existing Bose remote)* |
| `'3'` | Lighting | **Turn OFF Light 2 (Pin D3)** *(Existing Bose remote)* |
| `'W'` | Lighting | Turn ON Both Headlights (Master All-On) |
| `'w'` | Lighting | Turn OFF Both Headlights (Master All-Off) |
| `'q'` | Speed | Set Speed to Maximum (PWM 255) |
| `'0'`–`'9'` | Speed | Proportional Speed Scale (e.g. `'5'` = 50% PWM = ~128) |
| `'X'` | Safety | Emergency Kill Switch (Cuts all motors & flashes lights) |

---

## 7. Arduino Nano Firmware Architecture

### State Machine Diagram

```
                 ┌────────────────────────────────┐
                 │       setup() Initialization   │
                 │  • Serial & SoftwareSerial     │
                 │  • PinModes for L298N & LEDs   │
                 │  • Initial State: Motors Stopped│
                 └───────────────┬────────────────┘
                                 │
                                 ▼
                 ┌────────────────────────────────┐
        ┌───────►│          loop() Cycle          │
        │        └───────────────┬────────────────┘
        │                        │
        │                        ├──────────────────────────────┐
        │                        ▼                              ▼
        │              [ Check Bluetooth ]           [ Check Watchdog Timer ]
        │                        │                              │
        │             Bytes Available?               Signal Timeout > 600ms?
        │             ├── YES:                       ├── YES:
        │             │   • Read command byte        │   • Trigger Safe Stop (`S`)
        │             │   • Reset watchdog timer     │   • Log timeout warning
        │             │   • Execute Action Handler   │   └───┐
        │             └── NO: Continue               └───┤
        │                                                ▼
        └────────────────────────────────────────────────┘
```

### Complete Reference Firmware (`rc_car_nano.ino`)

```cpp
#include <SoftwareSerial.h>

// ==========================================
// PIN CONFIGURATION
// ==========================================
// Bluetooth HC-05 (TX -> D10, RX <- D11)
SoftwareSerial bluetooth(10, 11);

// Dual Lights
const int LIGHT1 = 2; // Left Headlight
const int LIGHT2 = 3; // Right Headlight

// L298N Motor Driver
const int ENA = 5;    // Left Motors PWM Speed
const int IN1 = 4;    // Left Motors Direction 1
const int IN2 = 7;    // Left Motors Direction 2
const int ENB = 6;    // Right Motors PWM Speed
const int IN3 = 8;    // Right Motors Direction 1
const int IN4 = 12;   // Right Motors Direction 2

// ==========================================
// STATE VARIABLES & WATCHDOG
// ==========================================
int currentSpeed = 200;               // Default speed (0 - 255)
unsigned long lastPacketTime = 0;     // For auto-stop safety watchdog
const unsigned long TIMEOUT_MS = 600; // Stop if no signal for 600ms
bool failsafeEnabled = true;

// ==========================================
// MOTOR CONTROL PRIMITIVES
// ==========================================
void stopMotors() {
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}

void moveForward() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  analogWrite(ENA, currentSpeed);
  analogWrite(ENB, currentSpeed);
}

void moveBackward() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  analogWrite(ENA, currentSpeed);
  analogWrite(ENB, currentSpeed);
}

void turnLeft() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH); // Left spins back
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);  // Right spins forward
  analogWrite(ENA, currentSpeed);
  analogWrite(ENB, currentSpeed);
}

void turnRight() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);  // Left spins forward
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH); // Right spins back
  analogWrite(ENA, currentSpeed);
  analogWrite(ENB, currentSpeed);
}

// ==========================================
// SETUP & LOOP
// ==========================================
void setup() {
  // Initialize Lights
  pinMode(LIGHT1, OUTPUT);
  pinMode(LIGHT2, OUTPUT);
  digitalWrite(LIGHT1, LOW);
  digitalWrite(LIGHT2, LOW);

  // Initialize Motor Pins
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  stopMotors();

  // Initialize Serial
  bluetooth.begin(9600);
  lastPacketTime = millis();
}

void loop() {
  // 1. Process Incoming Bluetooth Packets
  if (bluetooth.available()) {
    char cmd = bluetooth.read();
    lastPacketTime = millis(); // Reset watchdog timer

    switch (cmd) {
      // Motion Commands
      case 'F': moveForward(); break;
      case 'B': moveBackward(); break;
      case 'L': turnLeft(); break;
      case 'R': turnRight(); break;
      case 'S': stopMotors(); break;

      // Existing Light Commands
      case '1': digitalWrite(LIGHT1, HIGH); break;
      case '0': digitalWrite(LIGHT1, LOW); break;
      case '2': digitalWrite(LIGHT2, HIGH); break;
      case '3': digitalWrite(LIGHT2, LOW); break;

      // Master Light Controls
      case 'W': 
        digitalWrite(LIGHT1, HIGH); 
        digitalWrite(LIGHT2, HIGH); 
        break;
      case 'w': 
        digitalWrite(LIGHT1, LOW); 
        digitalWrite(LIGHT2, LOW); 
        break;

      // Speed Adjustments
      case 'q': currentSpeed = 255; break;
      default:
        // Numeric speed: '4' -> 40%, '9' -> 90%
        if (cmd >= '4' && cmd <= '9') {
          currentSpeed = map(cmd - '0', 4, 9, 120, 255);
        }
        break;
    }
  }

  // 2. Safety Watchdog: Auto-Brake on signal loss
  if (failsafeEnabled && (millis() - lastPacketTime > TIMEOUT_MS)) {
    stopMotors();
  }
}
```

---

## 8. Bose Remote UI Evolution Roadmap

The current **Bose remote** UI has established the minimalist aesthetic (rounded-md, zero shadows, light/dark themes, tactile feel, and live serial console). The RC Car features will expand it as follows:

```
┌──────────────────────────────────────────────────────────┐
│  Bose remote                       [ Light / Dark Mode ] │
│  Link: HC-05 Connected • 9600 Baud       [ Disconnect ]  │
├──────────────────────────────────────────────────────────┤
│  [ REMOTE ]                [ CAR PAD ]         [ CONSOLE]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│                     ┌──────────┐                         │
│                     │  ▲ FORW  │                         │
│               ┌─────┴──────────┴─────┐                   │
│               │ ◄ LEFT       RIGHT ► │                   │
│               └─────┬──────────┬─────┘                   │
│                     │  ▼ BACK  │                         │
│                     └──────────┘                         │
│                     [ ■ BRAKE ]                          │
│                                                          │
│  SPEED SELECTOR: [ 40% ] [ 60% ] [ 80% ] [ 100% ]        │
│                                                          │
│  HEADLIGHTS:                                             │
│  ┌───────────────────────┐   ┌────────────────────────┐  │
│  │ LEFT LIGHT (Pin D2)   │   │ RIGHT LIGHT (Pin D3)   │  │
│  │   [ ON ]     [ OFF ]  │   │   [ ON ]     [ OFF ]   │  │
│  └───────────────────────┘   └────────────────────────┘  │
│                                                          │
│  MASTER LIGHTS:  [ ⚡ ALL ON ]    [ ⭕ ALL OFF ]          │
│                                                          │
│  STATUS TELEMETRY:                                       │
│  • Signal Ping: 24ms      • Drive State: FORWARD         │
│  • Headlights: ACTIVE     • Failsafe Watchdog: ENGAGED   │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Step-by-Step Multi-Phase Development Roadmap

### Phase 1: Foundation (Current MVP)
- [x] Arduino Nano + HC-05 pairing at 9600 baud.
- [x] Dual-channel light control via Bose remote UI (Pin 2 and Pin 3).
- [ ] Connect L298N IN1–IN4 with jumpers on ENA/ENB (fixed speed).
- [ ] Test 4WD directional motion (`F`, `B`, `L`, `R`, `S`).

### Phase 2: Speed Control & Fail-Safe Protection
- [ ] Remove L298N jumpers and wire ENA to Nano D5 and ENB to Nano D6.
- [ ] Add PWM speed scaling in firmware (`analogWrite`).
- [ ] Implement 600ms auto-stop safety watchdog.
- [ ] Add D-Pad and speed buttons to the Bose remote UI.

### Phase 3: Obstacle Avoidance & Battery Telemetry
- [ ] Mount **HC-SR04 Ultrasonic Distance Sensor** on an **SG90 micro-servo** at the front bumper.
- [ ] Automatic Emergency Braking (AEB) in firmware if an obstacle is within 20cm.
- [ ] Wire battery voltage divider (10kΩ / 2.2kΩ) to Nano pin A0 to read real battery voltage and display battery percentage in the Bose remote UI.

### Phase 4: Autonomous Navigation & Sensor Fusion
- [ ] Add **3-Channel IR Line Tracking Sensor Module** for autonomous line-following mode.
- [ ] Mount **MPU-6050 6-Axis Gyroscope/Accelerometer** on I2C bus (A4/A5) to implement heading lock (keeps car driving in a laser-straight line even if motor speeds slightly differ).

### Phase 5: FPV Video Streaming
- [ ] Mount an **ESP32-CAM** or smartphone mount on the chassis.
- [ ] Embed the live low-latency MJPEG video stream directly inside the Bose remote web interface for a complete cockpit driving experience.

---

## 10. Safety, Fail-safes & Noise Suppression

1. **Flyback EMF Noise Suppression:**
   - DC brushed motors generate massive electrical noise (spikes up to 50V) from internal brush arcing.
   - **Solution:** Solder a 100nF (0.1µF) ceramic capacitor across the (+) and (-) terminals of each of the 4 motors.
2. **Signal Loss Watchdog:**
   - If the smartphone walks out of Bluetooth range or the browser tab closes while the car is moving forward at full speed, the car must NOT keep driving forever into a wall.
   - The firmware checks `millis() - lastPacketTime`. If greater than 600ms without a command, it forces `stopMotors()`.
3. **Emergency Physical Power Cut:**
   - Always install a physical toggle switch directly in-line with the battery positive terminal for instant power disconnection during testing.

---

## 11. Troubleshooting & Debugging Guide

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| **Car turns opposite of intended direction** | One side's motor polarity is reversed. | Swap the two motor output wires for that channel on the L298N terminal block. |
| **Arduino restarts when motors begin moving** | Voltage sag / brownout caused by motor inrush current. | Ensure battery is fully charged (Li-ion > 7.4V). Verify motor power does NOT pass through Arduino 5V regulator. Add a 470µF electrolytic capacitor across L298N power terminals. |
| **Motors hum or whine but do not rotate** | PWM speed too low to overcome gearbox friction, or low battery. | Increase minimum PWM starting value to at least 130–150. Check that motor supply voltage is $\ge$ 6V. |
| **HC-05 connects but ignores commands** | Baud rate mismatch or inverted RX/TX lines. | Ensure baud rate is set to `9600`. Check that Nano D10 connects to HC-05 TXD, and Nano D11 connects to HC-05 RXD. |
| **Only 2 wheels spin, other 2 are dead** | Loose terminal screw or motor pair wired in series instead of parallel. | Wire left motors in parallel to OUT1/OUT2, and right motors in parallel to OUT3/OUT4. Tighten all screw terminals. |

---

## 📝 Document Metadata
- **Project:** 4WD RC Smart Car (Bose Remote Ecosystem)
- **Status:** Architecture Blueprint (Scratch to Advanced)
- **Maintained in:** `docs/RC_CAR_PLAN.md`
- **Controller Interface:** [https://bluetooth-omega.vercel.app/](https://bluetooth-omega.vercel.app/)
