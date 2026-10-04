# ⚡ 4WD RC Car: Complete Circuit Diagram & Wiring Guide

This guide accompanies the native draw.io diagram file:  
📁 [**`docs/circuit_diagram.drawio`**](./circuit_diagram.drawio)  
🤖 [**`docs/arduino_nano_rc_car.ino`**](./arduino_nano_rc_car.ino) *(Complete Arduino Nano Firmware)*

---

## 🎨 How to Open and Edit the Draw.io File

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
    classDef l298 fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e40af;
    classDef nano fill:#f0f9ff,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef bt fill:#faf5ff,stroke:#a855f7,stroke-width:2px,color:#6b21a8;
    classDef motor fill:#dcfce7,stroke:#22c55e,stroke-width:2px,color:#15803d;
    classDef led fill:#fef9c3,stroke:#ca8a04,stroke-width:2px,color:#854d0e;
    classDef gnd fill:#334155,stroke:#0f172a,stroke-width:2px,color:#ffffff;

    subgraph POWER_SUPPLY ["1. Power Supply Rail"]
        BAT["18650 Li-ion Battery Pack<br/>(2S 7.4V - 8.4V)"]:::pwr
        SW["SPST Power Switch"]:::pwr
    end

    subgraph L298N_DRIVER ["2. L298N Motor Driver"]
        L298_PWR["12V Terminal Block"]:::l298
        L298_REG["Onboard 5V Regulator"]:::l298
        L298_IN["Logic Inputs<br/>ENA, IN1, IN2, IN3, IN4, ENB"]:::l298
        L298_OUT_L["OUT 1 & OUT 2<br/>(Left Channel)"]:::l298
        L298_OUT_R["OUT 3 & OUT 4<br/>(Right Channel)"]:::l298
    end

    subgraph MOTORS ["3. 4WD TT DC Gear Motors"]
        M_LEFT["Left Motors (Front + Rear)<br/>Wired in Parallel"]:::motor
        M_RIGHT["Right Motors (Front + Rear)<br/>Wired in Parallel"]:::motor
    end

    subgraph ARDUINO_NANO ["4. Arduino Nano Microcontroller"]
        NANO_PWR["5V Power & GND Pins"]:::nano
        NANO_PWM["PWM Speed Pins<br/>D5 (ENA) & D6 (ENB)"]:::nano
        NANO_DIR["Direction Pins<br/>D4 (IN1), D7 (IN2), D8 (IN3), D12 (IN4)"]:::nano
        NANO_BT_PINS["Serial Pins<br/>D10 (RX) & D11 (TX)"]:::nano
        NANO_LIGHT_PINS["Light Pins<br/>D2 (Light 1) & D3 (Light 2)"]:::nano
    end

    subgraph HC05_MODULE ["5. Bluetooth Receiver"]
        HC05["HC-05 Module (9600 Baud)<br/>VCC, GND, TXD, RXD"]:::bt
        VDIV["3.3V Voltage Divider<br/>(1kΩ + 2kΩ Resistors)"]:::bt
    end

    subgraph HEADLIGHTS ["6. Dual LED Lights"]
        LED1["Left Headlight<br/>White LED + 220Ω (D2)"]:::led
        LED2["Right Headlight<br/>White LED + 220Ω (D3)"]:::led
    end

    GND_BUS["COMMON GROUND BUS (GND)"]:::gnd

    %% Connections
    BAT -->|Battery +| SW
    SW -->|High Current +7.4V| L298_PWR
    BAT -->|Battery -| GND_BUS

    L298_PWR --> L298_REG
    L298_REG -->|Clean +5V Rail| NANO_PWR
    L298_REG -->|Clean +5V Rail| HC05

    L298_OUT_L --> M_LEFT
    L298_OUT_R --> M_RIGHT

    NANO_PWM --> L298_IN
    NANO_DIR --> L298_IN

    HC05 -->|TXD (3.3V Data)| NANO_BT_PINS
    NANO_BT_PINS -->|D11 TX (5V)| VDIV
    VDIV -->|Stepped to 3.3V| HC05

    NANO_LIGHT_PINS --> LED1
    NANO_LIGHT_PINS --> LED2

    %% Grounds
    L298_PWR -.->|GND| GND_BUS
    NANO_PWR -.->|GND| GND_BUS
    HC05 -.->|GND| GND_BUS
    LED1 -.->|Cathode GND| GND_BUS
    LED2 -.->|Cathode GND| GND_BUS
```

---

## 📌 Wire-by-Wire Connection Master Checklist

### 1. Power & Ground Distribution

| From Component | Pin / Terminal | To Component | Pin / Terminal | Wire Gauge / Color |
|---|---|---|---|:---:|
| **18650 Battery (+)** | Positive Lead | **Power Switch** | Input terminal | Red (Thick) |
| **Power Switch** | Output terminal | **L298N** | **+12V Screw Terminal** | Red (Thick) |
| **18650 Battery (-)** | Negative Lead | **Common GND Bus** | GND Rail | Black (Thick) |
| **L298N** | **GND Screw Terminal** | **Common GND Bus** | GND Rail | Black (Thick) |
| **L298N** | **+5V Screw Terminal** | **Arduino Nano** | **5V Pin** | Orange |
| **L298N** | **+5V Screw Terminal** | **HC-05 Bluetooth** | **VCC Pin** | Orange |
| **Arduino Nano** | **GND Pin** | **Common GND Bus** | GND Rail | Black |
| **HC-05 Bluetooth** | **GND Pin** | **Common GND Bus** | GND Rail | Black |

---

### 2. L298N Motor Driver Control Signals

| Arduino Nano Pin | Function | L298N Pin | Notes |
|:---:|---|:---:|---|
| **D5 (PWM)** | Left Motors Speed (0–255) | **ENA** | Remove onboard jumper |
| **D4** | Left Motors Forward Direction | **IN1** | High = Forward |
| **D7** | Left Motors Reverse Direction | **IN2** | High = Reverse |
| **D8** | Right Motors Forward Direction | **IN3** | High = Forward |
| **D12** | Right Motors Reverse Direction | **IN4** | High = Reverse |
| **D6 (PWM)** | Right Motors Speed (0–255) | **ENB** | Remove onboard jumper |

---

### 3. Motor Outputs (Skid-Steering 4WD)

| L298N Terminal | Connected Motor | Terminal | Notes |
|:---:|---|:---:|---|
| **OUT 1** | Front-Left Motor & Rear-Left Motor | Positive (+) | Solder 0.1µF ceramic cap across motor |
| **OUT 2** | Front-Left Motor & Rear-Left Motor | Negative (-) | Solder 0.1µF ceramic cap across motor |
| **OUT 3** | Front-Right Motor & Rear-Right Motor | Positive (+) | Solder 0.1µF ceramic cap across motor |
| **OUT 4** | Front-Right Motor & Rear-Right Motor | Negative (-) | Solder 0.1µF ceramic cap across motor |

---

### 4. HC-05 Bluetooth Receiver & 3.3V Divider

| Arduino Nano Pin | Voltage Divider Node | HC-05 Pin | Voltage Level | Notes |
|:---:|:---:|:---:|:---:|---|
| **D10 (RX)** | Direct Connection | **TXD** | 3.3V Logic | Nano easily reads 3.3V as HIGH |
| **D11 (TX)** | Connects to 1kΩ resistor | — | 5.0V Logic | Transmit output from Nano |
| — | Node between 1kΩ & 2kΩ | **RXD** | **3.3V Logic** | Safe for HC-05 RX |
| — | 2kΩ resistor to GND | **GND** | 0V | Pull-down ground return |

---

### 5. Dual LED Headlights

| Arduino Nano Pin | Component | Series Resistor | Return | Bose Remote Command |
|:---:|---|:---:|:---:|:---:|
| **D2** | Headlight 1 (Left LED) | 220Ω | Cathode $\rightarrow$ GND | `'1'` (ON) / `'0'` (OFF) |
| **D3** | Headlight 2 (Right LED) | 220Ω | Cathode $\rightarrow$ GND | `'2'` (ON) / `'3'` (OFF) |

---

## ⚡ Pro Tips for Assembly
1. **Twisted Pairs:** Twist the wires going from L298N OUT terminals to the motors to reduce electromagnetic interference (EMI).
2. **Motor Direction Check:** Before mounting the wheels, test motion in the air. If one side runs backward when commanding `'F'`, simply swap the two motor wires on the corresponding L298N screw terminal.
3. **Common Ground is Key:** 90% of erratic Bluetooth or motor stutter issues are caused by missing or loose common ground connections.
