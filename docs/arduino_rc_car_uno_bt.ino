/*
  ========================================================================================
  🏎️ 4WD RC SMART CAR - UNIVERSAL ARDUINO UNO + BLUETOOTH FIRMWARE
  ========================================================================================
  Controller:         Arduino Uno (or Nano)
  Bluetooth:          HC-05 / HM-10 / JDY (Listens on BOTH Hardware Serial & SoftwareSerial)
  Motor Driver:       L298N Dual H-Bridge Driver
  Motors:             4x TT DC Gear Motors (2 Left in parallel, 2 Right in parallel)
  Power:              2x 3.7V 18650 Li-ion in series (7.4V - 8.4V) + 2A Switch + Buck 5V
  Web Controller:     Bose Remote (https://bluetooth-omega.vercel.app/)

  ----------------------------------------------------------------------------------------
  PIN ASSIGNMENTS:
  ----------------------------------------------------------------------------------------
  • L298N Motor Driver:
      - IN1 Pin  ---> Arduino Pin D7  (Left Motors Forward)
      - IN2 Pin  ---> Arduino Pin D8  (Left Motors Reverse)
      - IN3 Pin  ---> Arduino Pin D9  (Right Motors Forward)
      - IN4 Pin  ---> Arduino Pin D10 (Right Motors Reverse)
      - ENA Pin  ---> Pin D5 (or keep black jumper cap installed on L298N)
      - ENB Pin  ---> Pin D6 (or keep black jumper cap installed on L298N)
      - +12V     ---> Battery (+) 7.4V (after 2A Switch)
      - GND      ---> Common GND (Battery (-), Buck OUT(-), Arduino GND)
      - +5V      ---> Buck Converter 5.0V Output (Remove 5V-EN jumper on L298N)

  • Bluetooth Module (HC-05 / HM-10):
      - VCC ---> Buck Converter 5.0V (or Uno 5V)
      - GND ---> Common GND
      - Option A (SoftwareSerial):
          * HC-05 TXD ---> Arduino Pin D3 (RX)
          * HC-05 RXD ---> Arduino Pin D4 (TX via 1k/2k divider)
      - Option B (Hardware Serial):
          * HC-05 TXD ---> Arduino Pin D0 (RX)
          * HC-05 RXD ---> Arduino Pin D1 (TX via 1k/2k divider)
      *(NOTE: This code listens to BOTH Option A and Option B automatically!)*

  • Built-in LED:
      - Pin D13 (LED_BUILTIN): Lights up whenever car is driving!
  ========================================================================================
*/

#include <SoftwareSerial.h>

// 1. PIN CONFIGURATION
// SoftwareSerial option on Pins 3 and 4
SoftwareSerial bt(3, 4); // RX = D3, TX = D4

// L298N Direction Pins
#define IN1 7
#define IN2 8
#define IN3 9
#define IN4 10

// L298N Speed Enable Pins (Keeps motors active even if user wired ENA/ENB to Uno instead of jumpers)
#define ENA_PIN 5
#define ENB_PIN 6

// Safety Watchdog (stops car if connection drops for > 3.0s while moving)
unsigned long lastCmdTime = 0;
const unsigned long SAFETY_TIMEOUT_MS = 3000;
bool isMoving = false;

// 2. MOTOR CONTROL FUNCTIONS
void drive(bool l1, bool l2, bool r1, bool r2) {
  // Ensure speed enables are active
  digitalWrite(ENA_PIN, HIGH);
  digitalWrite(ENB_PIN, HIGH);

  // Set direction pins
  digitalWrite(IN1, l1);
  digitalWrite(IN2, l2);
  digitalWrite(IN3, r1);
  digitalWrite(IN4, r2);

  if (l1 == 0 && l2 == 0 && r1 == 0 && r2 == 0) {
    isMoving = false;
    digitalWrite(LED_BUILTIN, LOW); // LED OFF = STOPPED
  } else {
    isMoving = true;
    digitalWrite(LED_BUILTIN, HIGH); // LED ON = MOTORS RUNNING
  }
}

void setup() {
  // Initialize Direction Pins
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  // Initialize Enable Pins
  pinMode(ENA_PIN, OUTPUT);
  pinMode(ENB_PIN, OUTPUT);
  digitalWrite(ENA_PIN, HIGH);
  digitalWrite(ENB_PIN, HIGH);

  // Initialize Built-in Status Indicator LED (Pin 13)
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  // Initialize SoftwareSerial for HC-05 (Pins 3 & 4)
  bt.begin(9600);

  // Initialize Hardware Serial (Pins 0 & 1 and USB cable)
  Serial.begin(9600);
  Serial.println(F("=================================================="));
  Serial.println(F("🏎️ 4WD RC Car Initialized (Hardware + Software Serial)"));
  Serial.println(F("Listening for commands: F, B, L, R, S"));
  Serial.println(F("=================================================="));

  // Start with all motors stopped
  drive(0, 0, 0, 0);
  lastCmdTime = millis();
}

void loop() {
  char c = 0;

  // Read from SoftwareSerial (HC-05 on pins 3/4)
  if (bt.available()) {
    c = bt.read();
  }
  // OR read from Hardware Serial (HC-05 on pins 0/1 or PC USB Serial)
  else if (Serial.available()) {
    c = Serial.read();
  }

  // If a command character arrived:
  if (c != 0 && c != '\r' && c != '\n' && c != ' ') {
    lastCmdTime = millis(); // Refresh watchdog

    switch (c) {
      case 'F':
      case 'f': // FORWARD
        drive(1, 0, 1, 0);
        Serial.println(F("[MOTORS] >>> FORWARD (F)"));
        bt.println(F("[MOTORS] >>> FORWARD (F)"));
        break;

      case 'B':
      case 'b': // REVERSE
        drive(0, 1, 0, 1);
        Serial.println(F("[MOTORS] <<< REVERSE (B)"));
        bt.println(F("[MOTORS] <<< REVERSE (B)"));
        break;

      case 'L':
      case 'l': // SPIN LEFT (Left reverse, Right forward)
        drive(0, 1, 1, 0);
        Serial.println(F("[MOTORS] <== SPIN LEFT (L)"));
        bt.println(F("[MOTORS] <== SPIN LEFT (L)"));
        break;

      case 'R':
      case 'r': // SPIN RIGHT (Left forward, Right reverse)
        drive(1, 0, 0, 1);
        Serial.println(F("[MOTORS] ==> SPIN RIGHT (R)"));
        bt.println(F("[MOTORS] ==> SPIN RIGHT (R)"));
        break;

      case 'S':
      case 's': // STOP / BRAKE
        drive(0, 0, 0, 0);
        Serial.println(F("[MOTORS] [🛑] STOP (S)"));
        bt.println(F("[MOTORS] [🛑] STOP (S)"));
        break;

      default:
        Serial.print(F("[UNKNOWN CMD] Received: "));
        Serial.println(c);
        break;
    }
  }

  // Safety Watchdog: If car has been driving for > 3s without any signal, safe-stop
  if (isMoving && (millis() - lastCmdTime > SAFETY_TIMEOUT_MS)) {
    drive(0, 0, 0, 0);
    Serial.println(F("[WATCHDOG] Connection silence > 3s -> Safe Brake"));
    bt.println(F("[WATCHDOG] Connection silence > 3s -> Safe Brake"));
  }
}
