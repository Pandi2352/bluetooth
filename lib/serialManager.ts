import { SerialPort } from "serialport";

export interface DeviceInfo {
  path: string;
  name: string;
  type: "bluetooth" | "usb" | "serial";
  isHC05: boolean;
  isArduino: boolean;
  description: string;
  status: "available" | "connected" | "busy";
}

export interface SerialStatus {
  isConnected: boolean;
  port: string | null;
  baudRate: number;
  led1State: boolean;
  led2State: boolean;
  lastError: string | null;
  logs: string[];
}

class SerialManager {
  private portInstance: SerialPort | null = null;
  private currentPortPath: string | null = null;
  private currentBaudRate: number = 9600;
  private led1State: boolean = false;
  private led2State: boolean = false;
  private lastError: string | null = null;
  private logs: string[] = [];

  constructor() {
    this.addLog("SerialManager initialized.");
  }

  public addLog(msg: string) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    this.logs.unshift(entry);
    if (this.logs.length > 50) {
      this.logs.pop();
    }
  }

  public async listDevices(): Promise<DeviceInfo[]> {
    try {
      const ports = await SerialPort.list();
      return ports.map((p) => {
        const friendly = (p.friendlyName || p.path).trim();
        const lower = friendly.toLowerCase();
        const pnpLower = (p.pnpId || "").toLowerCase();

        const isBluetooth =
          lower.includes("bluetooth") ||
          lower.includes("bth") ||
          lower.includes("hc-05") ||
          lower.includes("rfcomm") ||
          pnpLower.includes("bth");

        const isHC05 = lower.includes("hc-05") || lower.includes("hc05") || isBluetooth;

        const isArduino =
          lower.includes("ch340") ||
          lower.includes("arduino") ||
          lower.includes("nano") ||
          lower.includes("ftdi") ||
          lower.includes("cp210");

        let type: "bluetooth" | "usb" | "serial" = "serial";
        if (isBluetooth) type = "bluetooth";
        else if (isArduino || lower.includes("usb")) type = "usb";

        const isCurrentlyConnected =
          Boolean(this.portInstance?.isOpen) && this.currentPortPath === p.path;

        return {
          path: p.path,
          name: friendly,
          type,
          isHC05,
          isArduino,
          description: isBluetooth
            ? "Bluetooth Serial SPP Device"
            : isArduino
            ? "Arduino USB-to-UART Interface"
            : "Standard Serial Communication Port",
          status: isCurrentlyConnected ? "connected" : "available",
        };
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = `Failed to list ports: ${errorMsg}`;
      return [];
    }
  }

  public async connect(path: string, baudRate: number = 9600): Promise<boolean> {
    if (this.portInstance && this.portInstance.isOpen) {
      if (this.currentPortPath === path) {
        return true;
      }
      await this.disconnect();
    }

    return new Promise((resolve) => {
      try {
        this.addLog(`Connecting to ${path} at ${baudRate} baud...`);
        const port = new SerialPort({
          path,
          baudRate,
          autoOpen: false,
        });

        port.open((err) => {
          if (err) {
            this.lastError = `Error opening ${path}: ${err.message}`;
            this.addLog(`Failed to connect: ${err.message}`);
            this.portInstance = null;
            this.currentPortPath = null;
            resolve(false);
            return;
          }

          this.portInstance = port;
          this.currentPortPath = path;
          this.currentBaudRate = baudRate;
          this.lastError = null;
          this.addLog(`Connected successfully to ${path} at ${baudRate} baud.`);

          port.on("data", (data: Buffer) => {
            const str = data.toString().trim();
            if (str) {
              this.addLog(`Arduino: ${str}`);
            }
          });

          port.on("close", () => {
            this.addLog(`Port ${path} disconnected.`);
            this.portInstance = null;
            this.currentPortPath = null;
          });

          port.on("error", (portErr: Error) => {
            this.lastError = `Port error: ${portErr.message}`;
            this.addLog(`Port error: ${portErr.message}`);
          });

          resolve(true);
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.lastError = `Exception opening ${path}: ${errorMsg}`;
        this.addLog(this.lastError);
        resolve(false);
      }
    });
  }

  public async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.portInstance && this.portInstance.isOpen) {
        this.addLog(`Disconnecting from ${this.currentPortPath}...`);
        this.portInstance.close((err) => {
          if (err) {
            this.lastError = `Error closing port: ${err.message}`;
          }
          this.portInstance = null;
          this.currentPortPath = null;
          resolve();
        });
      } else {
        this.portInstance = null;
        this.currentPortPath = null;
        resolve();
      }
    });
  }

  public async sendCommand(command: string): Promise<boolean> {
    // Update internal state based on command:
    // '1' -> LED1 ON, '0' -> LED1 OFF
    // '2' -> LED2 ON, '3' -> LED2 OFF
    if (command === "1") this.led1State = true;
    else if (command === "0") this.led1State = false;
    else if (command === "2") this.led2State = true;
    else if (command === "3") this.led2State = false;

    if (!this.portInstance || !this.portInstance.isOpen) {
      this.lastError = "Serial port is not connected";
      this.addLog(`Simulated TX: "${command}" (LED1: ${this.led1State ? "ON" : "OFF"}, LED2: ${this.led2State ? "ON" : "OFF"})`);
      return true; // Still allow UI state updates in disconnected mode
    }

    return new Promise((resolve) => {
      this.portInstance?.write(command, (err) => {
        if (err) {
          this.lastError = `Failed to send command: ${err.message}`;
          this.addLog(`Send error: ${err.message}`);
          resolve(false);
          return;
        }

        this.addLog(`Sent to HC-05/Arduino: "${command}"`);
        resolve(true);
      });
    });
  }

  public getStatus(): SerialStatus {
    return {
      isConnected: Boolean(this.portInstance && this.portInstance.isOpen),
      port: this.currentPortPath,
      baudRate: this.currentBaudRate,
      led1State: this.led1State,
      led2State: this.led2State,
      lastError: this.lastError,
      logs: this.logs.slice(0, 30),
    };
  }
}

const globalForSerial = globalThis as unknown as {
  serialManagerInstance?: SerialManager;
};

export const serialManager =
  globalForSerial.serialManagerInstance ?? new SerialManager();

if (process.env.NODE_ENV !== "production") {
  globalForSerial.serialManagerInstance = serialManager;
}
