# ⚡ 4WD RC Car: Arduino Uno + Bluetooth + L298N Complete Circuit Guide

This guide accompanies the updated native draw.io diagram file:  
📁 [**`docs/circuit_diagram.drawio`**](./circuit_diagram.drawio)  
🤖 [**`docs/arduino_rc_car_uno_bt.ino`**](./arduino_rc_car_uno_bt.ino) *(Complete Arduino Uno + Bluetooth 4-Motor Firmware)*

---

## 🎨 How to Open and View the Draw.io File

You can view, edit, and export [`circuit_diagram.drawio`](./circuit_diagram.drawio) in several easy ways:

1. **Online (Instant & Free):**
   - Go to [**app.diagrams.net**](https://app.diagrams.net/).
   - Click **"Open Existing Diagram"** and select `docs/circuit_diagram.drawio`.
2. **In VS Code / Cursor / Windsurf:**
   - Install the **"Draw.io Integration"** extension (by Henning Dieterichs).
   - Click directly on `circuit_diagram.drawio` in the file explorer to view and edit visually.
3. **Exporting:**
   - Export to PNG, PDF, or SVG directly from the diagrams.net menu: `File > Export as > PNG / SVG`.

---

## 🗺️ Visual Circuit Schematic (Mermaid Diagram)

```mermaid
graph TD
    %% Styling Classes
    classDef pwr fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#991b1b;
    classDef buck fill:#ffedd5,stroke:#f97316,stroke-width:2px,color:#c2410c;
    classDef l298 fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e40af;
    classDef uno fill:#f0f9ff,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef bt fill:#faf5ff,stroke:#a855f7,stroke-width:2px,color:#6b21a8;
    classDef motor fill:#dcfce7,stroke:#22c55e,stroke-width:2px,color:#15803d;
    classDef gnd fill:#334155,stroke:#0f172a,stroke-width:2px,color:#ffffff;

    subgraph POWER_SUPPLY ["1. Power Supply Rail"]
        BAT["2x 18650 Li-ion Battery<br/>(Series: 7.4V - 8.4V)"]:::pwr
        SW["2A Power Switch"]:::pwr
        BUCK["DC-DC Buck Converter<br/>(Tuned to 5.0V Output)"]:::buck
    end

    subgraph L298N_DRIVER ["2. L298N Motor Driver"]
        L298_12V["12V Screw Terminal<br/>(From Battery 7.4V)"]:::l298
        L298_5V["5V Screw Terminal<br/>(From Buck 5.0V - Jumper REMOVED)"]:::l298
        L298_JUMPERS["ENA & ENB Jumpers: ON<br/>(Full Speed Driving)"]:::l298
        L298_IN["Direction Inputs<br/>IN1 (D7), IN2 (D8), IN3 (D9), IN4 (D10)"]:::l298
        L298_OUT_L["OUT 1 & OUT 2<br/>(Left Motor Pair)"]:::l298
        L298_OUT_R["OUT 3 & OUT 4<br/>(Right Motor Pair)"]:::l298
    end

    subgraph MOTORS ["3. 4WD TT DC Gear Motors (4 Motors Only)"]
        M_LEFT["Left Motors (Front + Rear)<br/>Wired in Parallel to OUT1 & OUT2"]:::motor
        M_RIGHT["Right Motors (Front + Rear)<br/>Wired in Parallel to OUT3 & OUT4"]:::motor
    end

    subgraph ARDUINO_UNO ["4. Arduino Uno Microcontroller"]
        UNO_PWR["5V Power & GND Pins<br/>(5V from Buck Converter)"]:::uno
        UNO_DIR["Direction Output Pins<br/>D7 (IN1), D8 (IN2), D9 (IN3), D10 (IN4)"]:::uno
        UNO_BT_PINS["SoftwareSerial Pins<br/>D3 (RX) & D4 (TX)"]:::uno
    end

    subgraph HC05_MODULE ["5. HC-05 Bluetooth Module"]
        HC05_PWR["VCC (5.0V from Buck) & GND"]:::bt
        HC05_TX["TXD (3.3V Data Out)"]:::bt
        HC05_RX["RXD (3.3V Data In)"]:::bt
        VDIV["Voltage Divider<br/>D4 ──[1k]──┬── RXD<br/>         [2k]<br/>          GND"]:::bt
    end

    GND_BUS["COMMON GROUND BUS (GND)"]:::gnd

    %% Power Connections
    BAT -->|Battery + (7.4V)| SW
    SW -->|High Current +7.4V| L298_12V
    SW -->|Input +7.4V| BUCK
    BAT -->|Battery -| GND_BUS

    BUCK -->|Clean Regulated +5.0V| L298_5V
    BUCK -->|Clean Regulated +5.0V| UNO_PWR
    BUCK -->|Clean Regulated +5.0V| HC05_PWR

    %% Motor Outputs
    L298_OUT_L --> M_LEFT
    L298_OUT_R --> M_RIGHT

    %% Arduino to L298N
    UNO_DIR --> L298_IN

    %% Bluetooth Serial
    HC05_TX -->|TXD to D3| UNO_BT_PINS
    UNO_BT_PINS -->|D4 (5V TX)| VDIV
    VDIV --> HC05_RX

    %% Ground Connections
    L298_12V -.->|L298N GND| GND_BUS
    BUCK -.->|IN- & OUT- GND| GND_BUS
    UNO_PWR -.->|Uno GND| GND_BUS
    HC05_PWR -.->|BT GND| GND_BUS
```

---

## 📌 Wire-by-Wire Connection Master Checklist

### 1. Power & Ground Distribution

| From Component | Pin / Terminal | To Component | Pin / Terminal | Wire Gauge / Color |
|---|---|---|---|:---:|
| **18650 Battery (+)** | Positive Lead (7.4V) | **2A Power Switch** | Input terminal | Red (Thick) |
| **2A Power Switch** | Output terminal | **L298N Driver** | **+12V Screw Terminal** | Red (Thick) |
| **2A Power Switch** | Output terminal | **Buck Converter** | **IN (+) Terminal** | Red |
| **18650 Battery (-)** | Negative Lead | **Common GND Bus** | GND Rail | Black (Thick) |
| **Buck Converter** | **IN (-) & OUT (-)** | **Common GND Bus** | GND Rail | Black |
| **L298N Driver** | **GND Screw Terminal** | **Common GND Bus** | GND Rail | Black (Thick) |
| **Buck Converter** | **OUT (+) (+5.0V)** | **L298N Driver** | **+5V Screw Terminal** *(Jumper REMOVED!)* | Orange |
| **Buck Converter** | **OUT (+) (+5.0V)** | **Arduino Uno** | **5V Pin** | Orange |
| **Buck Converter** | **OUT (+) (+5.0V)** | **HC-05 Bluetooth** | **VCC Pin** | Orange |
| **Arduino Uno** | **GND Pin** | **Common GND Bus** | GND Rail | Black |
| **HC-05 Bluetooth** | **GND Pin** | **Common GND Bus** | GND Rail | Black |

> **⚠️ CRITICAL BUCK CONVERTER SETUP:**  
> Before connecting the buck converter to the Arduino or L298N, turn the potentiometer screw with a multimeter on the output terminals until it reads **EXACTLY 5.00V**.

---

### 2. L298N Motor Driver Control Connections

| L298N Pin | Function | Arduino Uno Pin | Notes |
|:---:|---|:---:|---|
| **ENA** | Left Motors Speed | **JUMPER ON** | Keep jumper cap installed (full speed) |
| **IN1** | Left Motors Forward | **Pin D7** | High = Forward |
| **IN2** | Left Motors Reverse | **Pin D8** | High = Reverse |
| **IN3** | Right Motors Forward | **Pin D9** | High = Forward |
| **IN4** | Right Motors Reverse | **Pin D10** | High = Reverse |
| **ENB** | Right Motors Speed | **JUMPER ON** | Keep jumper cap installed (full speed) |
| **5V-EN** | 5V Regulator Jumper | **REMOVE JUMPER!** | L298N 5V pin receives clean power from buck converter |

---

### 3. Motor Outputs (Skid-Steering 4WD - 4 Motors)

| L298N Terminal | Connected Motors | Terminal | Notes |
|:---:|---|:---:|---|
| **OUT 1** | Front-Left Motor & Rear-Left Motor | Positive (+) | Solder 0.1µF ceramic capacitor across motor |
| **OUT 2** | Front-Left Motor & Rear-Left Motor | Negative (-) | Solder 0.1µF ceramic capacitor across motor |
| **OUT 3** | Front-Right Motor & Rear-Right Motor | Positive (+) | Solder 0.1µF ceramic capacitor across motor |
| **OUT 4** | Front-Right Motor & Rear-Right Motor | Negative (-) | Solder 0.1µF ceramic capacitor across motor |

---

### 4. HC-05 Bluetooth Receiver & 3.3V Divider

| Arduino Uno Pin | Voltage Divider Node | HC-05 Pin | Voltage Level | Notes |
|:---:|:---:|:---:|:---:|---|
| **Pin D3 (RX)** | Direct Connection | **TXD** | 3.3V Logic | Uno reads 3.3V as clean digital HIGH |
| **Pin D4 (TX)** | Connects to 1kΩ resistor | — | 5.0V Logic | Transmit signal from Uno |
| — | Node between 1kΩ & 2kΩ | **RXD** | **3.3V Logic** | Safe 3.3V level for HC-05 receiver |
| — | 2kΩ resistor to GND | **GND** | 0V | Ground pull-down return |

---

## 🕹️ Driving Commands Reference (4 Motors Only)

| Key / Button | Action | Command Byte | Description |
|:---:|:---:|:---:|:---|
| **W / ▲** | **Forward** | `'F'` | All 4 wheels drive forward (`IN1=1, IN2=0, IN3=1, IN4=0`) |
| **S / ▼** | **Reverse** | `'B'` | All 4 wheels drive in reverse (`IN1=0, IN2=1, IN3=0, IN4=1`) |
| **A / ◄** | **Turn Left** | `'L'` | Left wheels reverse, Right wheels forward (`IN1=0, IN2=1, IN3=1, IN4=0`) |
| **D / ►** | **Turn Right** | `'R'` | Left wheels forward, Right wheels reverse (`IN1=1, IN2=0, IN3=0, IN4=1`) |
| **Space / 🛑** | **Brake / Stop** | `'S'` | Electronic dynamic brake (`IN1=0, IN2=0, IN3=0, IN4=0`) |

---

## ⚡ Step-by-Step Build Order

1. **Test Battery Holder:** Verify with your multimeter that the battery holder outputs **7.4V–8.4V** in series.
2. **Tune Buck Converter:** Wire battery $\rightarrow$ 2A switch $\rightarrow$ Buck converter input only. Turn on switch, measure buck output, and adjust screw until output is **5.00V**. Turn off switch.
3. **Remove L298N 5V-EN Jumper:** Take off the small jumper cap next to the power screw terminals. Leave ENA and ENB jumpers installed.
4. **Wire Power & Common GND:** Connect Buck 5V to Uno 5V pin, L298N 5V terminal, and HC-05 VCC. Tie all negative wires to Common GND.
5. **Connect Motors & Logic Wires:** Wire IN1–IN4 to D7–D10, and HC-05 to D3/D4 with the 1k/2k divider.
6. **Upload Firmware:** Open [`docs/arduino_rc_car_uno_bt.ino`](./arduino_rc_car_uno_bt.ino) in Arduino IDE, select **Arduino Uno**, and upload via USB cable.
7. **Test Wheels in Air:** Unplug USB, turn on battery switch, connect via [https://bluetooth-omega.vercel.app/](https://bluetooth-omega.vercel.app/), and test driving with wheels off the ground! If any motor spins backward, swap that motor's two wires on the L298N terminal.
