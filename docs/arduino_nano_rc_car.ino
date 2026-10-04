/*
  ========================================================================================
  🏎️ 4WD RC SMART CAR - COMPLETE ARDUINO NANO FIRMWARE
  ========================================================================================
  Target Controller: Arduino Nano (ATmega328P, 16 MHz, 5V)
  Wireless Module:   HC-05 Bluetooth 2.0 Module (Default 9600 Baud)
  Motor Driver:      L298N Dual H-Bridge Driver Module
  Motors:            4x TT DC Gear Motors (Skid-Steering Differential Drive)
  Lighting:          Dual LED Headlights (Channel 1: Pin 2, Channel 2: Pin 3)
  Controller UI:     Bose Remote Web App (https://bluetooth-omega.vercel.app/)
  
  ----------------------------------------------------------------------------------------
  PIN ASSIGNMENT SUMMARY:
  ----------------------------------------------------------------------------------------
  - Pin D2:  Headlight 1 (Left LED) via 220Ω resistor
  - Pin D3:  Headlight 2 (Right LED) via 220Ω resistor
  - Pin D4:  L298N IN1 (Left Motors Forward Direction)
  - Pin D5:  L298N ENA (Left Motors PWM Speed Control: 0 - 255)
  - Pin D6:  L298N ENB (Right Motors PWM Speed Control: 0 - 255)
  - Pin D7:  L298N IN2 (Left Motors Reverse Direction)
  - Pin D8:  L298N IN3 (Right Motors Forward Direction)
  - Pin D12: L298N IN4 (Right Motors Reverse Direction)
  - Pin D10: SoftwareSerial RX (Connects to HC-05 TXD)
  - Pin D11: SoftwareSerial TX (Connects to HC-05 RXD via 1kΩ/2kΩ voltage divider)
  - 5V Pin:  Connects to L298N 5V Output Terminal
  - GND:     Common Ground Bus (Battery negative, L298N GND, HC-05 GND, LED Cathodes)
  ========================================================================================
*/

#include <SoftwareSerial.h>

// ========================================================================================
// 1. PIN DEFINITIONS
// ========================================================================================

// Bluetooth Serial Pins
const int BT_RX_PIN = 10; // Nano D10 receives from HC-05 TXD
const int BT_TX_PIN = 11; // Nano D11 transmits to HC-05 RXD (via 3.3V voltage divider)

// Dual Headlights
const int PIN_LIGHT1 = 2; // Left Headlight
const int PIN_LIGHT2 = 3; // Right Headlight

// L298N Motor Driver Pins
const int PIN_ENA = 5;  // Left Motors Speed (Timer0 PWM)
const int PIN_IN1 = 4;  // Left Motors Direction 1
const int PIN_IN2 = 7;  // Left Motors Direction 2

const int PIN_ENB = 6;  // Right Motors Speed (Timer0 PWM)
const int PIN_IN3 = 8;  // Right Motors Direction 1
const int PIN_IN4 = 12; // Right Motors Direction 2

// Built-in status indicator LED
const int PIN_STATUS_LED = 13;

// Initialize SoftwareSerial on Pins 10 and 11
SoftwareSerial bluetooth(BT_RX_PIN, BT_TX_PIN);

// ========================================================================================
// 2. GLOBAL STATE & CONFIGURATION
// ========================================================================================

// Speed Configuration
int currentSpeed = 200;      // Default driving speed (Range: 0 to 255)
const int MIN_SPEED = 120;   // Minimum PWM to overcome TT gearbox starting friction
const int MAX_SPEED = 255;   // Maximum PWM (Full Battery Voltage)

// Safety Watchdog Configuration
// Automatically halts motors if no command is received within TIMEOUT_MS
unsigned long lastPacketTime = 0;
const unsigned long WATCHDOG_TIMEOUT_MS = 600; // 600 milliseconds safety window
bool watchdogActive = false; // True when car is in motion

// Current Driving State
enum DriveState {
  STATE_STOP,
  STATE_FORWARD,
  STATE_BACKWARD,
  STATE_LEFT,
  STATE_RIGHT,
  STATE_FWD_LEFT,
  STATE_FWD_RIGHT,
  STATE_BACK_LEFT,
  STATE_BACK_RIGHT
};
DriveState currentState = STATE_STOP;

// ========================================================================================
// 3. LOW-LEVEL MOTOR PRIMITIVES
// ========================================================================================

/**
 * Electronic Dynamic Brake: Immediately cuts PWM and grounds all H-bridge outputs
 */
void stopMotors() {
  analogWrite(PIN_ENA, 0);
  analogWrite(PIN_ENB, 0);
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, LOW);
  currentState = STATE_STOP;
  watchdogActive = false;
}

/**
 * Drive Straight Forward (All 4 wheels spin forward)
 */
void moveForward() {
  digitalWrite(PIN_IN1, HIGH);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, HIGH);
  digitalWrite(PIN_IN4, LOW);
  analogWrite(PIN_ENA, currentSpeed);
  analogWrite(PIN_ENB, currentSpeed);
  currentState = STATE_FORWARD;
  watchdogActive = true;
}

/**
 * Drive Straight Backward (All 4 wheels spin in reverse)
 */
void moveBackward() {
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, HIGH);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, HIGH);
  analogWrite(PIN_ENA, currentSpeed);
  analogWrite(PIN_ENB, currentSpeed);
  currentState = STATE_BACKWARD;
  watchdogActive = true;
}

/**
 * Skid-Steer Spin Left (Left wheels reverse, Right wheels forward for tight zero-radius turn)
 */
void spinLeft() {
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, HIGH); // Left side reverse
  digitalWrite(PIN_IN3, HIGH);
  digitalWrite(PIN_IN4, LOW);  // Right side forward
  analogWrite(PIN_ENA, currentSpeed);
  analogWrite(PIN_ENB, currentSpeed);
  currentState = STATE_LEFT;
  watchdogActive = true;
}

/**
 * Skid-Steer Spin Right (Left wheels forward, Right wheels reverse for tight zero-radius turn)
 */
void spinRight() {
  digitalWrite(PIN_IN1, HIGH);
  digitalWrite(PIN_IN2, LOW);  // Left side forward
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, HIGH); // Right side reverse
  analogWrite(PIN_ENA, currentSpeed);
  analogWrite(PIN_ENB, currentSpeed);
  currentState = STATE_RIGHT;
  watchdogActive = true;
}

/**
 * Forward Diagonal Left (Gentle arc turn while moving forward)
 */
void forwardLeft() {
  digitalWrite(PIN_IN1, HIGH);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, HIGH);
  digitalWrite(PIN_IN4, LOW);
  analogWrite(PIN_ENA, currentSpeed / 2); // Left motors slowed down
  analogWrite(PIN_ENB, currentSpeed);     // Right motors at full speed
  currentState = STATE_FWD_LEFT;
  watchdogActive = true;
}

/**
 * Forward Diagonal Right (Gentle arc turn while moving forward)
 */
void forwardRight() {
  digitalWrite(PIN_IN1, HIGH);
  digitalWrite(PIN_IN2, LOW);
  digitalWrite(PIN_IN3, HIGH);
  digitalWrite(PIN_IN4, LOW);
  analogWrite(PIN_ENA, currentSpeed);
  analogWrite(PIN_ENB, currentSpeed / 2); // Right motors slowed down
  currentState = STATE_FWD_RIGHT;
  watchdogActive = true;
}

/**
 * Backward Diagonal Left
 */
void backwardLeft() {
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, HIGH);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, HIGH);
  analogWrite(PIN_ENA, currentSpeed / 2);
  analogWrite(PIN_ENB, currentSpeed);
  currentState = STATE_BACK_LEFT;
  watchdogActive = true;
}

/**
 * Backward Diagonal Right
 */
void backwardRight() {
  digitalWrite(PIN_IN1, LOW);
  digitalWrite(PIN_IN2, HIGH);
  digitalWrite(PIN_IN3, LOW);
  digitalWrite(PIN_IN4, HIGH);
  analogWrite(PIN_ENA, currentSpeed);
  analogWrite(PIN_ENB, currentSpeed / 2);
  currentState = STATE_BACK_RIGHT;
  watchdogActive = true;
}

// ========================================================================================
// 4. SETUP ROUTINE
// ========================================================================================

void setup() {
  // Initialize Hardware USB Serial for PC Debugging
  Serial.begin(9600);

  // Initialize SoftwareSerial for HC-05 Bluetooth Module
  bluetooth.begin(9600);

  // Configure Dual Headlight Pins
  pinMode(PIN_LIGHT1, OUTPUT);
  pinMode(PIN_LIGHT2, OUTPUT);
  digitalWrite(PIN_LIGHT1, LOW);
  digitalWrite(PIN_LIGHT2, LOW);

  // Configure L298N Motor Control Pins
  pinMode(PIN_ENA, OUTPUT);
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_ENB, OUTPUT);
  pinMode(PIN_IN3, OUTPUT);
  pinMode(PIN_IN4, OUTPUT);

  // Configure Built-in Status LED
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Ensure motors start in complete STOP state
  stopMotors();

  // Initialize watchdog timestamp
  lastPacketTime = millis();

  // Print startup banner to Serial and Bluetooth Console
  bluetooth.println(F("======================================="));
  bluetooth.println(F("🏎️ BOSE REMOTE 4WD RC CAR FIRMWARE"));
  bluetooth.println(F("Status: READY • Baud: 9600"));
  bluetooth.println(F("Dual Lights: D2 (Ch1), D3 (Ch2)"));
  bluetooth.println(F("Motors: L298N 4WD Differential Drive"));
  bluetooth.println(F("======================================="));

  Serial.println(F("[RC CAR] Arduino Nano Booted Successfully."));
}

// ========================================================================================
// 5. MAIN EVENT LOOP
// ========================================================================================

void loop() {
  // --------------------------------------------------------------------------------------
  // A. Process Incoming Bluetooth Packets
  // --------------------------------------------------------------------------------------
  if (bluetooth.available()) {
    char cmd = bluetooth.read();
    lastPacketTime = millis(); // Refresh watchdog timer on every received packet

    // Flash status LED on packet receipt
    digitalWrite(PIN_STATUS_LED, HIGH);

    switch (cmd) {
      // ----------------------------------------------------------------------------------
      // MOTION COMMANDS (Bose Remote Pad)
      // ----------------------------------------------------------------------------------
      case 'F':
        moveForward();
        bluetooth.println(F("OK: FORWARD"));
        break;

      case 'B':
        moveBackward();
        bluetooth.println(F("OK: BACKWARD"));
        break;

      case 'L':
        spinLeft();
        bluetooth.println(F("OK: SPIN_LEFT"));
        break;

      case 'R':
        spinRight();
        bluetooth.println(F("OK: SPIN_RIGHT"));
        break;

      case 'S':
        stopMotors();
        bluetooth.println(F("OK: STOP"));
        break;

      case 'G':
        forwardLeft();
        bluetooth.println(F("OK: FWD_LEFT"));
        break;

      case 'I':
        forwardRight();
        bluetooth.println(F("OK: FWD_RIGHT"));
        break;

      case 'H':
        backwardLeft();
        bluetooth.println(F("OK: BACK_LEFT"));
        break;

      case 'J':
        backwardRight();
        bluetooth.println(F("OK: BACK_RIGHT"));
        break;

      // ----------------------------------------------------------------------------------
      // LIGHTING COMMANDS (Bose Remote Dual Channel Buttons)
      // ----------------------------------------------------------------------------------
      case '1': // Channel 1 (LED 1) ON
        digitalWrite(PIN_LIGHT1, HIGH);
        bluetooth.println(F("LIGHT1: ON"));
        break;

      case '0': // Channel 1 (LED 1) OFF
        digitalWrite(PIN_LIGHT1, LOW);
        bluetooth.println(F("LIGHT1: OFF"));
        break;

      case '2': // Channel 2 (LED 2) ON
        digitalWrite(PIN_LIGHT2, HIGH);
        bluetooth.println(F("LIGHT2: ON"));
        break;

      case '3': // Channel 2 (LED 2) OFF
        digitalWrite(PIN_LIGHT2, LOW);
        bluetooth.println(F("LIGHT2: OFF"));
        break;

      case 'W': // Master Both Lights ON
        digitalWrite(PIN_LIGHT1, HIGH);
        digitalWrite(PIN_LIGHT2, HIGH);
        bluetooth.println(F("LIGHTS: ALL_ON"));
        break;

      case 'w': // Master Both Lights OFF
        digitalWrite(PIN_LIGHT1, LOW);
        digitalWrite(PIN_LIGHT2, LOW);
        bluetooth.println(F("LIGHTS: ALL_OFF"));
        break;

      // ----------------------------------------------------------------------------------
      // SPEED SCALING COMMANDS
      // ----------------------------------------------------------------------------------
      case 'q': // 100% Maximum Speed
        currentSpeed = MAX_SPEED;
        bluetooth.println(F("SPEED: 100% (255)"));
        break;

      case '0':
        // Note: '0' turns off Light 1; if car is moving, it can also set speed or brake
        break;

      default:
        // Numeric Speed Presets: '4' to '9'
        if (cmd >= '4' && cmd <= '9') {
          int step = cmd - '0';
          currentSpeed = map(step, 4, 9, MIN_SPEED, MAX_SPEED);
          bluetooth.print(F("SPEED: "));
          bluetooth.print(step * 10);
          bluetooth.print(F("% (PWM "));
          bluetooth.print(currentSpeed);
          bluetooth.println(F(")"));
        }
        break;
    }

    digitalWrite(PIN_STATUS_LED, LOW);
  }

  // --------------------------------------------------------------------------------------
  // B. Safety Watchdog Timer: Auto-Brake on Signal Loss
  // --------------------------------------------------------------------------------------
  if (watchdogActive) {
    if (millis() - lastPacketTime > WATCHDOG_TIMEOUT_MS) {
      stopMotors();
      bluetooth.println(F("⚠️ WARN: SIGNAL TIMEOUT -> AUTO-BRAKE ENGAGED"));
      Serial.println(F("[SAFETY] Watchdog timeout triggered! Motors halted."));
    }
  }
}
