"use client";

import React, { useState, useEffect, useRef } from "react";

interface TerminalMessage {
  id: string;
  type: "tx" | "rx" | "system" | "error";
  text: string;
  timestamp: string;
}

export default function Home() {
  // Theme state: Default LIGHT MODE as requested
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Navigation Tabs: 'remote' | 'console'
  const [activeTab, setActiveTab] = useState<"remote" | "console">("remote");

  // Bluetooth Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<"webbluetooth" | "webserial" | "backend" | null>(null);

  // RC Car Driving states ('F' = Forward, 'B' = Reverse, 'L' = Left, 'R' = Right, 'STOP' = Brake)
  const [driveState, setDriveState] = useState<"STOP" | "F" | "B" | "L" | "R">("STOP");
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Terminal Console states
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [inputCommand, setInputCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lineEnding, setLineEnding] = useState<"none" | "nl" | "crnl" | "cr">("none");
  const [displayMode, setDisplayMode] = useState<"ascii" | "hex">("ascii");
  const [autoScroll, setAutoScroll] = useState(true);

  // Hardware references
  const gattTxCharRef = useRef<any>(null);
  const gattDeviceRef = useRef<any>(null);
  const serialPortRef = useRef<any>(null);
  const serialWriterRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const isWritingRef = useRef<boolean>(false);

  // Tactile haptic feedback for physical remote feel
  const triggerHaptic = () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(30);
      } catch {
        // Ignore if restricted
      }
    }
  };

  // Add terminal message
  const addMessage = (text: string, type: "tx" | "rx" | "system" | "error") => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setMessages((prev) => [
      ...prev.slice(-300),
      { id: Math.random().toString(36).substring(2, 9), type, text, timestamp },
    ]);
  };

  const stringToHex = (str: string) => {
    return Array.from(str)
      .map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))
      .join(" ");
  };

  // Autoscroll terminal
  useEffect(() => {
    if (autoScroll && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Connect via Web Bluetooth (Mobile Chrome / Android / HTTPS)
  const connectWebBluetooth = async () => {
    if (typeof window === "undefined" || !("bluetooth" in navigator)) {
      addMessage("Web Bluetooth API not supported in this browser. Please use Chrome on Android.", "error");
      return;
    }

    try {
      setIsConnecting(true);
      triggerHaptic();
      addMessage("Scanning for Bluetooth devices...", "system");

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 BLE Service
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service
          "0000fff0-0000-1000-8000-00805f9b34fb", // JDY-08 / JDY-30 / JDY-31
          "generic_access",
        ],
      });

      addMessage(`Connecting to ${device.name || "Device"}...`, "system");
      const server = await device.gatt.connect();
      gattDeviceRef.current = device;

      device.addEventListener("gattserverdisconnected", () => {
        setIsConnected(false);
        setConnectedDeviceName(null);
        setConnectionType(null);
        gattTxCharRef.current = null;
        gattDeviceRef.current = null;
        addMessage("Bluetooth device disconnected.", "system");
      });

      let txChar: any = null;
      let rxChar: any = null;

      // Try HM-10 Service
      try {
        const hm10Service = await server.getPrimaryService("0000ffe0-0000-1000-8000-00805f9b34fb").catch(() => null);
        if (hm10Service) {
          txChar = await hm10Service.getCharacteristic("0000ffe1-0000-1000-8000-00805f9b34fb").catch(() => null);
          rxChar = txChar;
        }
      } catch {
        // Continue
      }

      // Try Nordic UART Service
      if (!txChar) {
        try {
          const nusService = await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e").catch(() => null);
          if (nusService) {
            txChar = await nusService.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e").catch(() => null);
            rxChar = await nusService.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e").catch(() => null);
          }
        } catch {
          // Continue
        }
      }

      // Try JDY Service
      if (!txChar) {
        try {
          const jdyService = await server.getPrimaryService("0000fff0-0000-1000-8000-00805f9b34fb").catch(() => null);
          if (jdyService) {
            txChar = await jdyService.getCharacteristic("0000fff1-0000-1000-8000-00805f9b34fb").catch(() => null);
            rxChar = txChar;
          }
        } catch {
          // Continue
        }
      }

      if (txChar) {
        gattTxCharRef.current = txChar;
      } else {
        addMessage("Note: Connected to GATT, but serial TX characteristic not found. Commands will also route via backend fallback.", "system");
      }

      if (rxChar && rxChar.startNotifications) {
        try {
          await rxChar.startNotifications();
          rxChar.addEventListener("characteristicvaluechanged", (e: any) => {
            const val = new TextDecoder().decode(e.target.value).trim();
            if (val) {
              addMessage(val, "rx");
            }
          });
        } catch {
          // Notifications optional
        }
      }

      setIsConnected(true);
      setConnectedDeviceName(device.name || "Bluetooth RC Car");
      setConnectionType("webbluetooth");
      addMessage(`Connected to ${device.name || "Bluetooth RC Car"}!`, "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cancelled";
      addMessage(`Connection note: ${msg}`, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect via Web Serial (Chromium Desktop / USB / Bluetooth SPP COM Port)
  const connectWebSerial = async () => {
    if (typeof window === "undefined" || !("serial" in navigator)) {
      addMessage("Web Serial API not available. Use Web Bluetooth mode on mobile.", "error");
      return;
    }

    try {
      setIsConnecting(true);
      triggerHaptic();
      addMessage("Opening Serial Port picker...", "system");

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      serialPortRef.current = port;

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      serialWriterRef.current = textEncoder.writable.getWriter();

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReaderRef.current = reader;

      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const clean = value.replace("\r", "").trim();
              if (clean) addMessage(clean, "rx");
            }
          }
        } catch {
          // Port closed
        }
      })();

      setIsConnected(true);
      setConnectedDeviceName("HC-05 Serial");
      setConnectionType("webserial");
      addMessage("Connected via Web Serial at 9600 baud!", "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cancelled";
      addMessage(`Serial error: ${msg}`, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    triggerHaptic();
    if (connectionType === "webbluetooth" && gattDeviceRef.current?.gatt) {
      try {
        gattDeviceRef.current.gatt.disconnect();
      } catch {
        // Ignore
      }
      gattTxCharRef.current = null;
      gattDeviceRef.current = null;
    } else if (connectionType === "webserial") {
      try {
        if (serialWriterRef.current) await serialWriterRef.current.close();
        if (serialReaderRef.current) await serialReaderRef.current.cancel();
        if (serialPortRef.current) await serialPortRef.current.close();
      } catch {
        // Ignore
      }
      serialWriterRef.current = null;
      serialReaderRef.current = null;
      serialPortRef.current = null;
    } else {
      try {
        await fetch("/api/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "disconnect" }),
        });
      } catch {
        // Ignore
      }
    }

    setIsConnected(false);
    setConnectedDeviceName(null);
    setConnectionType(null);
    setDriveState("STOP");
    addMessage("Disconnected.", "system");
  };

  // Direct, Bulletproof Send Command
  const sendCommand = async (rawCmd: string, label?: string) => {
    triggerHaptic();

    let payload = rawCmd;
    if (lineEnding === "nl") payload += "\n";
    else if (lineEnding === "crnl") payload += "\r\n";
    else if (lineEnding === "cr") payload += "\r";

    // Immediate state updates
    if (rawCmd === "F") {
      setDriveState("F");
      setLastAction("FORWARD ('F')");
    } else if (rawCmd === "B") {
      setDriveState("B");
      setLastAction("REVERSE ('B')");
    } else if (rawCmd === "L") {
      setDriveState("L");
      setLastAction("LEFT ('L')");
    } else if (rawCmd === "R") {
      setDriveState("R");
      setLastAction("RIGHT ('R')");
    } else if (rawCmd === "S") {
      setDriveState("STOP");
      setLastAction("STOP ('S')");
    } else {
      setLastAction(label || `Sent '${rawCmd}'`);
    }

    setCommandHistory((prev) => [rawCmd, ...prev.slice(0, 20)]);
    setHistoryIndex(-1);

    const displayText = displayMode === "hex" ? stringToHex(payload) : rawCmd;
    addMessage(displayText, "tx");

    // 1. Web Bluetooth Transmit
    if (connectionType === "webbluetooth" && gattTxCharRef.current) {
      if (!isWritingRef.current) {
        isWritingRef.current = true;
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(payload);
          if (gattTxCharRef.current.writeValueWithoutResponse) {
            await gattTxCharRef.current.writeValueWithoutResponse(data);
          } else {
            await gattTxCharRef.current.writeValue(data);
          }
        } catch (err: unknown) {
          addMessage(`BLE TX Note: ${err instanceof Error ? err.message : String(err)}`, "error");
        } finally {
          isWritingRef.current = false;
        }
      }
    }

    // 2. Web Serial Transmit
    if (connectionType === "webserial" && serialWriterRef.current) {
      try {
        await serialWriterRef.current.write(payload);
      } catch (err: unknown) {
        addMessage(`Serial TX Error: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }

    // 3. Backend Fallback (Local API if running on PC with USB)
    try {
      fetch("/api/led", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: rawCmd }),
      }).catch(() => {});
    } catch {
      // Ignore
    }
  };

  // Keyboard navigation listener (Arrow keys & WASD driving support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      if (key === "arrowup" || key === "w") {
        e.preventDefault();
        sendCommand("F");
      } else if (key === "arrowdown" || key === "s") {
        e.preventDefault();
        sendCommand("B");
      } else if (key === "arrowleft" || key === "a") {
        e.preventDefault();
        sendCommand("L");
      } else if (key === "arrowright" || key === "d") {
        e.preventDefault();
        sendCommand("R");
      } else if (key === " " || key === "escape") {
        e.preventDefault();
        sendCommand("S");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;
    sendCommand(inputCommand);
    setInputCommand("");
  };

  const isDark = theme === "dark";

  return (
    <main
      className={`min-h-screen transition-colors duration-300 font-sans flex flex-col items-center justify-start px-2 py-2 sm:px-4 sm:py-6 w-full ${
        isDark ? "bg-black text-zinc-100" : "bg-slate-100 text-slate-800"
      }`}
    >
      <div className="w-full max-w-sm space-y-2">
        {/* Top App Bar with Light/Dark Mode & Brand */}
        <header
          className={`flex items-center justify-between px-3 py-2 rounded-md border transition-all ${
            isDark
              ? "bg-zinc-900 border-zinc-800"
              : "bg-white border-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-black text-xs">
              B
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wide leading-none uppercase">
                Bose remote
              </h1>
              <p className={`text-[10px] leading-tight font-medium ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                4WD RC Car Controller (4 Motors)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
              className={`p-1.5 rounded-md border transition cursor-pointer ${
                isDark
                  ? "bg-zinc-800 border-zinc-700 text-yellow-400 hover:bg-zinc-700"
                  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {isDark ? (
                // Sun Icon (Switch to Light)
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                // Moon Icon (Switch to Dark)
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Tab Switcher: Bose Remote vs Kai Morich Serial Console */}
        <nav
          className={`grid grid-cols-2 p-1 rounded-md border gap-1 transition-all ${
            isDark
              ? "bg-zinc-900 border-zinc-800"
              : "bg-slate-200 border-slate-300"
          }`}
        >
          <button
            onClick={() => {
              triggerHaptic();
              setActiveTab("remote");
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-bold text-xs tracking-wider transition cursor-pointer border ${
              activeTab === "remote"
                ? isDark
                  ? "bg-zinc-800 text-white border-zinc-700"
                  : "bg-white text-slate-900 border-slate-300"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="14" height="20" x="5" y="2" rx="2" />
              <line x1="8" x2="8.01" y1="6" y2="6" strokeWidth="3" />
              <circle cx="12" cy="14" r="2" />
            </svg>
            REMOTE
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setActiveTab("console");
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-bold text-xs tracking-wider transition cursor-pointer border ${
              activeTab === "console"
                ? isDark
                  ? "bg-zinc-800 text-white border-zinc-700"
                  : "bg-white text-slate-900 border-slate-300"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" x2="20" y1="19" y2="19" />
            </svg>
            SERIAL CONSOLE
          </button>
        </nav>

        {/* Global Connection Header Bar */}
        <section
          className={`p-2.5 rounded-md border flex items-center justify-between transition-all ${
            isDark
              ? "bg-zinc-900 border-zinc-800"
              : "bg-white border-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-md inline-block ${
                isConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <div>
              <p className="text-xs font-bold leading-tight">
                {isConnected ? connectedDeviceName || "Bluetooth Device" : "Disconnected"}
              </p>
              <p className={`text-[10px] ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                {isConnected ? "Link active • 9600 Baud" : "Tap Connect to pair"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isConnected ? (
              <>
                <button
                  onClick={connectWebBluetooth}
                  disabled={isConnecting}
                  className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
                <button
                  onClick={connectWebSerial}
                  title="Serial port (PC / SPP)"
                  className={`px-2 py-1 rounded-md text-xs font-semibold border transition cursor-pointer ${
                    isDark
                      ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  SPP
                </button>
              </>
            ) : (
              <button
                onClick={handleDisconnect}
                className="px-2.5 py-1 rounded-md bg-rose-600/10 text-rose-500 border border-rose-500/20 hover:bg-rose-600/20 text-xs font-bold transition cursor-pointer"
              >
                Disconnect
              </button>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* TAB 1: ACTUAL BOSE PHYSICAL REMOTE CONTROL FEEL             */}
        {/* ============================================================ */}
        {activeTab === "remote" && (
          <div
            className={`rounded-md border p-2 sm:p-3 space-y-2.5 transition-all ${
              isDark
                ? "bg-zinc-900 border-zinc-800"
                : "bg-white border-slate-300"
            }`}
          >
            {/* Bose Remote Top Notch & Brand Header */}
            <div className="text-center space-y-1">
              <div
                className={`w-10 h-1.5 rounded-md mx-auto border ${
                  isDark
                    ? "bg-zinc-800 border-zinc-700"
                    : "bg-slate-300 border-slate-400"
                }`}
              />
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-xs font-black tracking-widest uppercase">
                  Bose remote
                </span>
                <span className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                  • 4WD RC Car
                </span>
              </div>
            </div>

            {/* Live Drive State Pill */}
            <div
              className={`p-2 rounded-md border flex items-center justify-between text-xs font-mono font-bold transition-all ${
                driveState === "F"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                  : driveState === "B"
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-500"
                  : driveState === "L" || driveState === "R"
                  ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-500"
                  : isDark
                  ? "bg-zinc-950 border-zinc-800 text-zinc-400"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-md ${
                    driveState !== "STOP" ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                  }`}
                />
                <span>
                  {driveState === "F"
                    ? "▲ DRIVING FORWARD ('F')"
                    : driveState === "B"
                    ? "▼ REVERSING ('B')"
                    : driveState === "L"
                    ? "◄ SPINNING LEFT ('L')"
                    : driveState === "R"
                    ? "► SPINNING RIGHT ('R')"
                    : "🛑 STOPPED / NEUTRAL ('S')"}
                </span>
              </div>
              <span className="text-[10px] opacity-75">
                {driveState !== "STOP" ? "Active" : "Brake Ready"}
              </span>
            </div>

            {/* ============================================================ */}
            {/* TACTILE 4-MOTOR RC D-PAD CONTROLLER (4 MOTORS ONLY)         */}
            {/* ============================================================ */}
            <div
              className={`p-3 rounded-md border text-center space-y-2.5 ${
                isDark ? "bg-zinc-950 border-zinc-800" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-slate-600"}`}>
                  4-Motor Motion Pad
                </span>
                <span className={`text-[9px] font-mono ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                  Tap to drive • Tap Stop to brake
                </span>
              </div>

              {/* 3x3 D-Pad Matrix for 4 Motors */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                {/* Row 1: Spacer | FORWARD | Spacer */}
                <div />

                {/* FORWARD BUTTON */}
                <button
                  type="button"
                  onClick={() => sendCommand("F")}
                  className={`py-3.5 px-2 rounded-md font-black text-sm tracking-wider uppercase border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center ${
                    driveState === "F"
                      ? "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/40"
                      : isDark
                      ? "bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border-zinc-700"
                      : "bg-white hover:bg-slate-100 text-emerald-600 border-slate-300"
                  }`}
                >
                  <span className="text-xl leading-none">▲</span>
                  <span className="text-xs font-black mt-1">FORWARD</span>
                  <span className="text-[9px] font-mono opacity-75">[W / ↑]</span>
                </button>

                <div />

                {/* Row 2: LEFT | STOP / BRAKE | RIGHT */}
                {/* LEFT BUTTON */}
                <button
                  type="button"
                  onClick={() => sendCommand("L")}
                  className={`py-3.5 px-2 rounded-md font-black text-sm tracking-wider uppercase border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center ${
                    driveState === "L"
                      ? "bg-cyan-600 text-white border-cyan-500 ring-2 ring-cyan-500/40"
                      : isDark
                      ? "bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border-zinc-700"
                      : "bg-white hover:bg-slate-100 text-cyan-600 border-slate-300"
                  }`}
                >
                  <span className="text-xl leading-none">◄</span>
                  <span className="text-xs font-black mt-1">LEFT</span>
                  <span className="text-[9px] font-mono opacity-75">[A / ←]</span>
                </button>

                {/* EMERGENCY STOP BUTTON */}
                <button
                  type="button"
                  onClick={() => sendCommand("S")}
                  className="py-3.5 px-2 rounded-md font-black text-sm tracking-wider uppercase border border-rose-600 bg-rose-600 hover:bg-rose-500 text-white cursor-pointer active:scale-95 flex flex-col items-center justify-center"
                >
                  <span className="text-lg leading-none">🛑</span>
                  <span className="text-xs font-black mt-1">STOP</span>
                  <span className="text-[9px] font-mono opacity-80">[SPACE]</span>
                </button>

                {/* RIGHT BUTTON */}
                <button
                  type="button"
                  onClick={() => sendCommand("R")}
                  className={`py-3.5 px-2 rounded-md font-black text-sm tracking-wider uppercase border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center ${
                    driveState === "R"
                      ? "bg-cyan-600 text-white border-cyan-500 ring-2 ring-cyan-500/40"
                      : isDark
                      ? "bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border-zinc-700"
                      : "bg-white hover:bg-slate-100 text-cyan-600 border-slate-300"
                  }`}
                >
                  <span className="text-xl leading-none">►</span>
                  <span className="text-xs font-black mt-1">RIGHT</span>
                  <span className="text-[9px] font-mono opacity-75">[D / →]</span>
                </button>

                {/* Row 3: SPIN LEFT | REVERSE | SPIN RIGHT */}
                {/* SPIN LEFT */}
                <button
                  type="button"
                  onClick={() => sendCommand("L")}
                  className={`py-2 px-1 rounded-md font-bold text-[10px] uppercase border transition active:scale-95 cursor-pointer flex flex-col items-center justify-center ${
                    driveState === "L"
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-500"
                      : isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                      : "bg-white border-slate-300 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="text-base">↺</span>
                  <span>SPIN L</span>
                </button>

                {/* REVERSE BUTTON */}
                <button
                  type="button"
                  onClick={() => sendCommand("B")}
                  className={`py-3.5 px-2 rounded-md font-black text-sm tracking-wider uppercase border transition cursor-pointer active:scale-95 flex flex-col items-center justify-center ${
                    driveState === "B"
                      ? "bg-amber-600 text-white border-amber-500 ring-2 ring-amber-500/40"
                      : isDark
                      ? "bg-zinc-800 hover:bg-zinc-700 text-amber-400 border-zinc-700"
                      : "bg-white hover:bg-slate-100 text-amber-600 border-slate-300"
                  }`}
                >
                  <span className="text-xl leading-none">▼</span>
                  <span className="text-xs font-black mt-1">BACK</span>
                  <span className="text-[9px] font-mono opacity-75">[S / ↓]</span>
                </button>

                {/* SPIN RIGHT */}
                <button
                  type="button"
                  onClick={() => sendCommand("R")}
                  className={`py-2 px-1 rounded-md font-bold text-[10px] uppercase border transition active:scale-95 cursor-pointer flex flex-col items-center justify-center ${
                    driveState === "R"
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-500"
                      : isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                      : "bg-white border-slate-300 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="text-base">↻</span>
                  <span>SPIN R</span>
                </button>
              </div>

              {/* Master Brake Button */}
              <button
                type="button"
                onClick={() => sendCommand("S")}
                className={`w-full py-2 rounded-md font-bold text-xs tracking-wider uppercase border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  isDark
                    ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-rose-400"
                    : "bg-slate-100 border-slate-300 hover:bg-slate-200 text-rose-700"
                }`}
              >
                <span>🛑</span>
                <span>BRAKE ALL 4 MOTORS ('S')</span>
              </button>

              {/* Keyboard Driving Guide Footer Pill */}
              <div
                className={`pt-1 text-[10px] font-mono ${
                  isDark ? "text-zinc-500" : "text-slate-500"
                }`}
              >
                Drive with keyboard: <span className="font-bold">W / ↑</span> (Fwd) • <span className="font-bold">S / ↓</span> (Rev) • <span className="font-bold">A / ←</span> (Left) • <span className="font-bold">D / →</span> (Right) • <span className="font-bold">Space</span> (Brake)
              </div>
            </div>

            {/* Last Action Bar at base of remote */}
            <div
              className={`pt-1 border-t flex items-center justify-between text-[11px] font-mono ${
                isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-slate-500"
              }`}
            >
              <span>{lastAction ? `TX > ${lastAction}` : "4-Motor RC Car Ready"}</span>
              <button
                onClick={() => setActiveTab("console")}
                className="text-blue-500 font-bold hover:underline cursor-pointer"
              >
                View Console &gt;
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: SERIAL CONSOLE (FULL TERMINAL ENGINE)                 */}
        {/* ============================================================ */}
        {activeTab === "console" && (
          <div
            className={`rounded-md border p-2 sm:p-3 space-y-2 transition-all ${
              isDark
                ? "bg-zinc-900 border-zinc-800"
                : "bg-white border-slate-300"
            }`}
          >
            {/* Terminal Top Control Bar */}
            <div
              className={`flex items-center justify-between pb-2 border-b text-xs ${
                isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-slate-600"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold flex items-center gap-1 text-xs text-blue-500">
                  <span className="w-1.5 h-1.5 rounded-md bg-emerald-500 inline-block" />
                  TERMINAL
                </span>
                <span className="text-[10px] font-mono text-zinc-400">9600 Baud</span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Hex / ASCII mode */}
                <button
                  onClick={() => setDisplayMode(displayMode === "ascii" ? "hex" : "ascii")}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border transition cursor-pointer ${
                    isDark
                      ? "bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white"
                      : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {displayMode.toUpperCase()}
                </button>

                {/* Line Ending */}
                <select
                  value={lineEnding}
                  onChange={(e) => setLineEnding(e.target.value as any)}
                  className={`rounded-md px-1 py-0.5 text-[10px] font-mono border focus:outline-none cursor-pointer ${
                    isDark
                      ? "bg-zinc-950 border-zinc-800 text-zinc-300"
                      : "bg-slate-100 border-slate-300 text-slate-700"
                  }`}
                >
                  <option value="none">None</option>
                  <option value="nl">NL (\n)</option>
                  <option value="crnl">CR+NL (\r\n)</option>
                  <option value="cr">CR (\r)</option>
                </select>

                {/* Auto Scroll Toggle */}
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono border transition cursor-pointer ${
                    autoScroll
                      ? "bg-blue-600/20 text-blue-500 border-blue-500/40"
                      : isDark
                      ? "bg-zinc-800 text-zinc-500 border-zinc-700"
                      : "bg-slate-100 text-slate-400 border-slate-300"
                  }`}
                >
                  SCROLL
                </button>

                {/* Clear Console */}
                <button
                  onClick={() => {
                    triggerHaptic();
                    setMessages([]);
                  }}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono border transition cursor-pointer ${
                    isDark
                      ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                  }`}
                >
                  CLEAR
                </button>
              </div>
            </div>

            {/* Terminal Screen / Messages Viewport */}
            <div
              className={`h-64 overflow-y-auto p-2.5 font-mono text-xs rounded-md border space-y-1 select-text ${
                isDark
                  ? "bg-zinc-950 border-zinc-800 text-zinc-200"
                  : "bg-slate-900 border-slate-800 text-slate-200"
              }`}
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-1 text-center py-6">
                  <p className="font-semibold text-xs text-zinc-400">Terminal ready (9600 Baud)</p>
                  <p className="text-[10px] text-zinc-600">Send F, B, L, R, S or custom ASCII</p>
                </div>
              ) : (
                messages.map((m) => {
                  if (m.type === "tx") {
                    return (
                      <div key={m.id} className="flex items-start gap-1.5 text-blue-400">
                        <span className="text-zinc-600 text-[10px] select-none">{m.timestamp}</span>
                        <span className="text-blue-500 font-bold select-none">[TX &gt;]</span>
                        <span className="font-semibold break-all">{m.text}</span>
                      </div>
                    );
                  }
                  if (m.type === "rx") {
                    return (
                      <div key={m.id} className="flex items-start gap-1.5 text-emerald-400">
                        <span className="text-zinc-600 text-[10px] select-none">{m.timestamp}</span>
                        <span className="text-emerald-500 font-bold select-none">[RX &lt;]</span>
                        <span className="font-semibold break-all">{m.text}</span>
                      </div>
                    );
                  }
                  if (m.type === "error") {
                    return (
                      <div key={m.id} className="flex items-start gap-1.5 text-rose-400">
                        <span className="text-zinc-600 text-[10px] select-none">{m.timestamp}</span>
                        <span className="text-rose-500 font-bold select-none">[ERR]</span>
                        <span className="break-all">{m.text}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="flex items-start gap-1.5 text-amber-400/90 italic">
                      <span className="text-zinc-600 text-[10px] select-none">{m.timestamp}</span>
                      <span className="text-amber-500 font-bold select-none">[SYS]</span>
                      <span className="break-all">{m.text}</span>
                    </div>
                  );
                })
              )}
              <div ref={terminalBottomRef} />
            </div>

            {/* Quick Macro Shortcuts (Pure 4-Motor Commands) */}
            <div className="flex flex-wrap gap-1.5 pt-0.5 items-center">
              <span className={`text-[10px] font-bold ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                RC Macros:
              </span>
              <button
                type="button"
                onClick={() => sendCommand("F")}
                className="px-2 py-0.5 rounded-md bg-emerald-600/10 text-emerald-600 border border-emerald-500/30 text-[11px] font-mono font-bold hover:bg-emerald-600/20 cursor-pointer"
              >
                Fwd (F)
              </button>
              <button
                type="button"
                onClick={() => sendCommand("B")}
                className="px-2 py-0.5 rounded-md bg-amber-600/10 text-amber-600 border border-amber-500/30 text-[11px] font-mono font-bold hover:bg-amber-600/20 cursor-pointer"
              >
                Back (B)
              </button>
              <button
                type="button"
                onClick={() => sendCommand("L")}
                className="px-2 py-0.5 rounded-md bg-cyan-600/10 text-cyan-600 border border-cyan-500/30 text-[11px] font-mono font-bold hover:bg-cyan-600/20 cursor-pointer"
              >
                Left (L)
              </button>
              <button
                type="button"
                onClick={() => sendCommand("R")}
                className="px-2 py-0.5 rounded-md bg-cyan-600/10 text-cyan-600 border border-cyan-500/30 text-[11px] font-mono font-bold hover:bg-cyan-600/20 cursor-pointer"
              >
                Right (R)
              </button>
              <button
                type="button"
                onClick={() => sendCommand("S")}
                className="px-2 py-0.5 rounded-md bg-rose-600/10 text-rose-600 border border-rose-500/30 text-[11px] font-mono font-bold hover:bg-rose-600/20 cursor-pointer"
              >
                Stop (S)
              </button>
            </div>

            {/* Command Send Bar */}
            <form onSubmit={handleFormSubmit} className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                placeholder="Type command ('F', 'B', 'L', 'R', 'S')..."
                className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  isDark
                    ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder-slate-400"
                }`}
              />
              <button
                type="submit"
                disabled={!inputCommand.trim()}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                SEND
              </button>
            </form>
          </div>
        )}

        {/* Global Footer info */}
        <footer className="text-center pt-2">
          <p className={`text-[10px] font-mono ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
            Bose remote • 4WD RC Car Controller (4 Motors • L298N • Bluetooth)
          </p>
        </footer>
      </div>
    </main>
  );
}
