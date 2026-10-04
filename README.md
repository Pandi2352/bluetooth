# Next.js Bluetooth Remote Control for Arduino Nano & HC-05

A complete, self-contained Next.js IoT Remote Controller to wirelessly switch an LED ON/OFF via an HC-05 Bluetooth module and an Arduino Nano.

**No separate backend or external broker needed** — the backend serial communication runs directly inside Next.js API route handlers using Node.js `serialport`.

---

## ⚡ Architecture Flow

```
[ Next.js Remote UI (Browser) ]
              │
              │ HTTP / Fetch API (POST /api/led, POST /api/connect)
              ▼
[ Next.js App Router Backend API ]
              │
              │ Node.js SerialPort (lib/serialManager.ts)
              ▼
[ Windows Virtual Bluetooth COM Port / USB-Serial ]
              │
              │ Wireless Bluetooth SPP (2.4 GHz)
              ▼
[ HC-05 Bluetooth Module ]
              │
              │ UART Serial (TX / RX at 9600 Baud)
              ▼
[ Arduino Nano ]
              │
              │ Digital Output (Pin 13 or Pin 2)
              ▼
           [ LED ]
```

---

## 🔌 Hardware Wiring Diagram

### 1. HC-05 Bluetooth to Arduino Nano

| HC-05 Pin | Arduino Nano Pin | Note |
|---|---|---|
| **VCC** | **5V** | Power supply |
| **GND** | **GND** | Common ground |
| **TXD** | **D10** (RX) | SoftwareSerial RX |
| **RXD** | **D11** (TX) | *Recommended:* Use voltage divider (1kΩ / 2kΩ) because HC-05 RX is 3.3V logic |
| **STATE** | Not connected | Optional |
| **EN / KEY**| Not connected | Leave floating for normal data mode |

> **Note on Voltage Divider for HC-05 RXD:**
> - Arduino Nano D11 ──[ 1kΩ ]──┬── HC-05 RXD
>                              │
>                            [ 2kΩ ]
>                              │
>                             GND

### 2. LED Connection
- **Anode (+, long leg):** Arduino Nano **Pin 13** (Built-in LED) or **Pin 2** through a 220Ω resistor.
- **Cathode (-, short leg):** Arduino **GND**.

---

## 🚀 Getting Started

### Step 1: Upload Arduino Sketch
1. Open the Arduino IDE.
2. Open [`arduino/arduino_hc05_led.ino`](./arduino/arduino_hc05_led.ino).
3. Select your Board: **Arduino Nano** (Processor: ATmega328P / Old Bootloader).
4. Select the COM Port and click **Upload**.

### Step 2: Pair HC-05 with Windows
1. On your PC, open **Settings > Bluetooth & devices > Add device**.
2. Select **Bluetooth** and wait for **HC-05** to appear.
3. Click to pair and enter PIN: `1234` or `0000`.
4. Windows will pair the HC-05 and assign an outgoing Standard Serial over Bluetooth port (e.g. `COM4`, `COM6`, etc.).

### Step 3: Run the Next.js Remote
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🎮 How to Use the Remote Control

1. Click **"Setup Port"** or the gear icon in the top right.
2. Select your Bluetooth COM port (or USB COM port e.g. `COM5`).
3. Click **"Connect Hardware"**. The indicator will turn **Green** (Connected).
4. Click **"Turn ON"**:
   - Sends `'1'` to Arduino via HC-05.
   - Nano turns the LED ON.
   - UI status glows green with real-time feedback.
5. Click **"Turn OFF"**:
   - Sends `'0'` to Arduino via HC-05.
   - Nano turns the LED OFF.
   - UI status updates to OFF.

---

## 🛠️ Project Structure

- [`app/page.tsx`](./app/page.tsx) - Modern Dark Glassmorphic Remote Control UI.
- [`app/api/led/route.ts`](./app/api/led/route.ts) - API to switch LED ON/OFF (`POST /api/led`).
- [`app/api/ports/route.ts`](./app/api/ports/route.ts) - Scans and lists available COM / Bluetooth ports.
- [`app/api/connect/route.ts`](./app/api/connect/route.ts) - Connects/disconnects hardware port.
- [`lib/serialManager.ts`](./lib/serialManager.ts) - Next.js persistent backend singleton managing the serial connection.
- [`arduino/arduino_hc05_led.ino`](./arduino/arduino_hc05_led.ino) - C++ Arduino sketch for the Nano.
