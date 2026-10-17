/*
  ========================================================================================
  🏎️ 4WD RC SMART CAR - COMPLETE ARDUINO UNO + BLUETOOTH FIRMWARE
  ========================================================================================
  Controller Board:   Arduino Uno (or Nano with identical pinout)
  Wireless Receiver:  HC-05 Bluetooth Module (9600 Baud)
  Motor Driver:       L298N Dual H-Bridge Driver Module (ENA & ENB Jumpers Installed)
  Motors:             4x TT DC Gear Motors (2 Left in parallel, 2 Right in parallel)
  Power Source:       2x 3.7V 18650 Li-ion in series (7.4V nominal, 8.4V full)
  Power Switch:       2A Rocker/Toggle Switch on Battery (+) line
  Voltage Regulator:  Buck Converter (tuned to 5.0V output)
  Web Controller:     Bose Remote (https://bluetooth-omega.vercel.app/)

  ----------------------------------------------------------------------------------------
  EXACT PIN CONNECTIONS:
  ----------------------------------------------------------------------------------------
  • Bluetooth Module (HC-05):
      - VCC  ---> Buck Converter 5.0V Output (or Uno 5V pin)
      - GND  ---> Common Ground (GND rail)
      - TXD  ---> Arduino Uno Pin D3 (SoftwareSerial RX)
      - RXD  ---> Arduino Uno Pin D4 (SoftwareSerial TX through 1kΩ/2kΩ voltage divider)
      
      Voltage Divider on HC-05 RXD:
      Uno Pin D4 (5V) ───[ 1kΩ Resistor ]───┬─── HC-05 RXD (3.3V Logic)
                                            │
                                   [ 2kΩ Resistor ]
                                            │
                                       Common GND

  • L298N Dual H-Bridge Driver:
      - 12V Screw Terminal ---> Battery (+) 7.4V (after the 2A switch)
      - GND Screw Terminal ---> Common Ground (GND rail)
      - 5V Screw Terminal  ---> Buck Converter 5.0V Output (REMOVE 5V-EN Jumper!)
      - ENA & ENB Jumpers  ---> KEEP BOTH JUMPERS ON (Full Speed Drive)
      - IN1 Pin            ---> Arduino Uno Pin D7 (Left Motors Forward)
      - IN2 Pin            ---> Arduino Uno Pin D8 (Left Motors Reverse)
      - IN3 Pin            ---> Arduino Uno Pin D9 (Right Motors Forward)
      - IN4 Pin            ---> Arduino Uno Pin D10 (Right Motors Reverse)

  • 4x TT DC Gear Motors (Wired in Parallel):
      - Left Front + Left Rear Motors   ---> L298N OUT1 & OUT2
      - Right Front + Right Rear Motors ---> L298N OUT3 & OUT4

  • Optional Dual Headlights (Pins D2 & D11/D12):
      - Headlight 1 (Left LED)  ---> Arduino Pin D2 (via 220Ω resistor)
      - Headlight 2 (Right LED) ---> Arduino Pin D12 (via 220Ω resistor)
  ========================================================================================
*/

#include <SoftwareSerial.h>

// --------------------------------------------------------------------------------------
// 1. PIN ALLOCATION
// --------------------------------------------------------------------------------------

// Bluetooth Serial (TXD on module -> Pin 3, RXD on module -> Pin 4 via divider)
SoftwareSerial bt(3, 4); // RX = D3, TX = D4

// L298N Direction Logic Pins
#define IN1 7  // Left Motors Forward
#define IN2 8  // Left Motors Reverse
#define IN3 9  // Right Motors Forward
#define IN4 10 // Right Motors Reverse

// Optional Dual Headlight Pins
#define LIGHT1 2  // Left Headlight LED
#define LIGHT2 12 // Right Headlight LED (Optional)

// --------------------------------------------------------------------------------------
// 2. TIMING & SAFETY WATCHDOG
// --------------------------------------------------------------------------------------
unsigned long lastCmdTime = 0;
const unsigned long SAFETY_TIMEOUT_MS = 400; // Auto-stop if no packet for 0.4s
bool isMoving = false;

// --------------------------------------------------------------------------------------
// 3. MOTOR DRIVE PRIMITIVES
// --------------------------------------------------------------------------------------

/**
 * Low-level motor controller
 * @param l1 Left Forward
 * @param l2 Left Reverse
 * @param r1 Right Forward
 * @param r2 Right Reverse
 */
void drive(bool l1, bool l2, bool r1, bool r2) {
  digitalWrite(IN1, l1);
  digitalWrite(IN2, l2);
  digitalWrite(IN3, r1);
  digitalWrite(IN4, r2);
  
  if (l1 == 0 && l2 == 0 && r1 == 0 && r2 == 0) {
    isMoving = false;
  } else {
    isMoving = true;
  }
}

// --------------------------------------------------------------------------------------
// 4. SETUP INITIALIZATION
// --------------------------------------------------------------------------------------
void setup() {
  // Initialize Motor Direction Pins
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  // Initialize Headlight Pins
  pinMode(LIGHT1, OUTPUT);
  pinMode(LIGHT2, OUTPUT);
  digitalWrite(LIGHT1, LOW);
  digitalWrite(LIGHT2, LOW);

  // Initialize Bluetooth Communication at 9600 Baud
  bt.begin(9600);
  
  // Initialize Hardware USB Serial for PC debugging
  Serial.begin(9600);
  Serial.println(F("[RC CAR] Arduino Uno Initialized."));

  // Ensure all motors start completely stopped
  drive(0, 0, 0, 0);
  lastCmdTime = millis();
}

// --------------------------------------------------------------------------------------
// 5. MAIN NON-BLOCKING EVENT LOOP
// --------------------------------------------------------------------------------------
void loop() {
  // A. Read incoming Bluetooth commands
  while (bt.available()) {
    char c = bt.read();
    lastCmdTime = millis(); // Refresh watchdog timer on every command packet

    switch (c) {
      // Motion Driving Commands (Streamed from Bose Remote D-Pad)
      case 'F': // Drive Forward
        drive(1, 0, 1, 0);
        break;

      case 'B': // Drive Backward (Reverse)
        drive(0, 1, 0, 1);
        break;

      case 'L': // Spin Left (Left reverse, Right forward)
        drive(0, 1, 1, 0);
        break;

      case 'R': // Spin Right (Left forward, Right reverse)
        drive(1, 0, 0, 1);
        break;

      case 'S': // Electronic Brake / Full Stop
        drive(0, 0, 0, 0);
        break;

      // Lighting Commands (from Bose Remote Light Buttons)
      case '1': // Light 1 ON
        digitalWrite(LIGHT1, HIGH);
        bt.println(F("LT1: ON"));
        break;

      case '0': // Light 1 OFF
        digitalWrite(LIGHT1, LOW);
        bt.println(F("LT1: OFF"));
        break;

      case '2': // Light 2 ON
        digitalWrite(LIGHT2, HIGH);
        bt.println(F("LT2: ON"));
        break;

      case '3': // Light 2 OFF
        digitalWrite(LIGHT2, LOW);
        bt.println(F("LT2: OFF"));
        break;

      case 'W': // Master Both Lights ON
        digitalWrite(LIGHT1, HIGH);
        digitalWrite(LIGHT2, HIGH);
        bt.println(F("LIGHTS: ALL ON"));
        break;

      case 'w': // Master Both Lights OFF
        digitalWrite(LIGHT1, LOW);
        digitalWrite(LIGHT2, LOW);
        bt.println(F("LIGHTS: ALL OFF"));
        break;
    }
  }

  // B. Safety Watchdog: Auto-Brake after 0.4 seconds of no signal
  // Prevents the RC car from running away if Bluetooth drops or user releases button
  if (isMoving && (millis() - lastCmdTime > SAFETY_TIMEOUT_MS)) {
    drive(0, 0, 0, 0);
  }
}
