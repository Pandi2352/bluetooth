/*
  ========================================================================================
  🏎️ 4WD RC SMART CAR - ARDUINO UNO + BLUETOOTH FIRMWARE (PURE 4-MOTOR CONTROL)
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

// --------------------------------------------------------------------------------------
// 2. TIMING & SAFETY WATCHDOG
// --------------------------------------------------------------------------------------
unsigned long lastCmdTime = 0;
// Safety failsafe: If connection is lost or no command received for 2.5s while moving, auto-stop.
const unsigned long SAFETY_TIMEOUT_MS = 2500;
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

  // Initialize Bluetooth Communication at 9600 Baud
  bt.begin(9600);
  
  // Initialize Hardware USB Serial for PC debugging
  Serial.begin(9600);
  Serial.println(F("[RC CAR] 4WD Arduino Uno Initialized."));

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
    lastCmdTime = millis(); // Refresh watchdog timer on every received command

    switch (c) {
      // Motion Driving Commands (4 Motors Only)
      case 'F': // Drive Forward (All 4 Motors Forward)
        drive(1, 0, 1, 0);
        bt.println(F("MOTORS: FWD"));
        break;

      case 'B': // Drive Backward (All 4 Motors Reverse)
        drive(0, 1, 0, 1);
        bt.println(F("MOTORS: REV"));
        break;

      case 'L': // Turn Left (Left Reverse, Right Forward)
        drive(0, 1, 1, 0);
        bt.println(F("MOTORS: LEFT"));
        break;

      case 'R': // Turn Right (Left Forward, Right Reverse)
        drive(1, 0, 0, 1);
        bt.println(F("MOTORS: RIGHT"));
        break;

      case 'S': // Electronic Brake / Full Stop (All 4 Motors OFF)
        drive(0, 0, 0, 0);
        bt.println(F("MOTORS: STOP"));
        break;

      default:
        // Ignore linefeeds or carriage returns
        break;
    }
  }

  // B. Safety Watchdog: Auto-Brake if Bluetooth signal is completely lost for 2.5s
  // Prevents runaway car if user drives out of Bluetooth range
  if (isMoving && (millis() - lastCmdTime > SAFETY_TIMEOUT_MS)) {
    drive(0, 0, 0, 0);
    bt.println(F("WATCHDOG: SAFE STOP"));
  }
}
