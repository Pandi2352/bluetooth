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

  // Dual LED states
  const [led1On, setLed1On] = useState(false); // Pin 2 ('1' = ON, '0' = OFF)
  const [led2On, setLed2On] = useState(false); // Pin 3 ('2' = ON, '3' = OFF)
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

  // Connect via Web Bluetooth (Mobile Chrome / HTTPS)
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
        addMessage("Bluetooth device disconnected.", "system");
      });

      let txChar: any = null;
      let rxChar: any = null;

      try {
        const hm10Service = await server.getPrimaryService("0000ffe0-0000-1000-8000-00805f9b34fb").catch(() => null);
        if (hm10Service) {
          txChar = await hm10Service.getCharacteristic("0000ffe1-0000-1000-8000-00805f9b34fb").catch(() => null);
          rxChar = txChar;
        }

        if (!txChar) {
          const nusService = await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e").catch(() => null);
          if (nusService) {
            txChar = await nusService.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e").catch(() => null);
            rxChar = await nusService.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e").catch(() => null);
          }
        }

        if (txChar) {
          gattTxCharRef.current = txChar;
        }

        if (rxChar && rxChar.startNotifications) {
          await rxChar.startNotifications();
          rxChar.addEventListener("characteristicvaluechanged", (e: any) => {
            const val = new TextDecoder().decode(e.target.value).trim();
            if (val) {
              addMessage(val, "rx");
              if (val.includes("1") || val.toLowerCase().includes("on")) setLed1On(true);
              if (val.includes("0") || val.toLowerCase().includes("off")) setLed1On(false);
            }
          });
        }
      } catch {
        // Continue
      }

      setIsConnected(true);
      setConnectedDeviceName(device.name || "Bluetooth Device");
      setConnectionType("webbluetooth");
      addMessage(`Connected to ${device.name || "Bluetooth Device"}!`, "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cancelled";
      addMessage(`Connection note: ${msg}`, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect via Web Serial (Chromium Desktop)
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
          // Closed
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
    addMessage("Disconnected.", "system");
  };

  // Send Command ('1', '0', '2', '3' or custom)
  const sendCommand = async (rawCmd: string, label?: string) => {
    triggerHaptic();

    let payload = rawCmd;
    if (lineEnding === "nl") payload += "\n";
    else if (lineEnding === "crnl") payload += "\r\n";
    else if (lineEnding === "cr") payload += "\r";

    // Track internal LED status
    if (rawCmd === "1") {
      setLed1On(true);
      setLastAction("LED 1 ON ('1')");
    } else if (rawCmd === "0") {
      setLed1On(false);
      setLastAction("LED 1 OFF ('0')");
    } else if (rawCmd === "2") {
      setLed2On(true);
      setLastAction("LED 2 ON ('2')");
    } else if (rawCmd === "3") {
      setLed2On(false);
      setLastAction("LED 2 OFF ('3')");
    } else {
      setLastAction(label || `Sent '${rawCmd}'`);
    }

    // Save in history
    setCommandHistory((prev) => [rawCmd, ...prev.slice(0, 20)]);
    setHistoryIndex(-1);

    const displayText = displayMode === "hex" ? stringToHex(payload) : rawCmd;
    addMessage(displayText, "tx");

    // 1. Web Bluetooth Transmit
    if (connectionType === "webbluetooth" && gattTxCharRef.current) {
      try {
        const encoder = new TextEncoder();
        await gattTxCharRef.current.writeValue(encoder.encode(payload));
        return;
      } catch (err: unknown) {
        addMessage(`BLE TX Error: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }

    // 2. Web Serial Transmit
    if (connectionType === "webserial" && serialWriterRef.current) {
      try {
        await serialWriterRef.current.write(payload);
        return;
      } catch (err: unknown) {
        addMessage(`Serial TX Error: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }

    // 3. Backend Fallback
    try {
      await fetch("/api/led", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: rawCmd }),
      });
    } catch {
      // Offline/client-only
    }
  };

  const handleAllOn = () => {
    sendCommand("1");
    setTimeout(() => sendCommand("2"), 120);
  };

  const handleAllOff = () => {
    sendCommand("0");
    setTimeout(() => sendCommand("3"), 120);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;
    sendCommand(inputCommand);
    setInputCommand("");
  };

  const isDark = theme === "dark";

  return (
    <main
      className={`min-h-screen transition-colors duration-300 font-sans flex flex-col items-center justify-start p-3 sm:p-6 ${
        isDark ? "bg-zinc-950 text-white" : "bg-slate-100 text-slate-900"
      }`}
    >
      <div className="w-full max-w-md space-y-4">
        
        {/* Top App Bar with Light/Dark Mode & Brand */}
        <header className="flex items-center justify-between px-2 pt-1 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m7 7 10 10-5 5V2l5 5L7 17" />
              </svg>
            </div>
            <span className="font-extrabold text-sm tracking-tight">
              BT Remote Control
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
              className={`p-2 rounded-xl transition cursor-pointer border ${
                isDark
                  ? "bg-zinc-900 border-zinc-800 text-amber-400 hover:bg-zinc-800"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              }`}
            >
              {isDark ? (
                // Sun Icon (Switch to Light)
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                // Moon Icon (Switch to Dark)
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Segmented Two-Tab Navigation */}
        <nav
          className={`grid grid-cols-2 p-1.5 rounded-2xl border transition-all ${
            isDark
              ? "bg-zinc-900/90 border-zinc-800"
              : "bg-slate-200/90 border-slate-300/80 shadow-inner"
          }`}
        >
          <button
            onClick={() => {
              triggerHaptic();
              setActiveTab("remote");
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs tracking-wide transition cursor-pointer ${
              activeTab === "remote"
                ? isDark
                  ? "bg-zinc-800 text-white shadow-md"
                  : "bg-white text-slate-900 shadow-md ring-1 ring-slate-900/5"
                : isDark
                ? "text-zinc-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="14" height="20" x="5" y="2" rx="4" />
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
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs tracking-wide transition cursor-pointer ${
              activeTab === "console"
                ? isDark
                  ? "bg-zinc-800 text-white shadow-md"
                  : "bg-white text-slate-900 shadow-md ring-1 ring-slate-900/5"
                : isDark
                ? "text-zinc-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" x2="20" y1="19" y2="19" />
            </svg>
            SERIAL CONSOLE
          </button>
        </nav>

        {/* Global Connection Header Bar */}
        <section
          className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
            isDark
              ? "bg-zinc-900/80 border-zinc-800"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isConnected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </span>
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
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
                <button
                  onClick={connectWebSerial}
                  title="Serial port (PC)"
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
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
                className="px-3 py-1.5 rounded-xl bg-rose-600/10 text-rose-500 hover:bg-rose-600/20 text-xs font-bold transition cursor-pointer"
              >
                Disconnect
              </button>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* TAB 1: ACTUAL PHYSICAL REMOTE CONTROL FEEL                  */}
        {/* ============================================================ */}
        {activeTab === "remote" && (
          <div
            className={`rounded-[36px] border p-6 relative overflow-hidden transition-all shadow-2xl ${
              isDark
                ? "bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800 shadow-black/80"
                : "bg-gradient-to-b from-white via-slate-50 to-slate-200 border-slate-300/80 shadow-slate-300/70"
            }`}
          >
            {/* Remote Infrared Lens Accent at top center */}
            <div className="flex flex-col items-center mb-6">
              <div
                className={`w-12 h-2.5 rounded-full mb-3 border shadow-inner ${
                  isDark
                    ? "bg-zinc-800 border-zinc-700"
                    : "bg-slate-300 border-slate-400"
                }`}
              />
              <span className={`text-[10px] uppercase font-black tracking-widest ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                Dual Channel Wireless Controller
              </span>
            </div>

            {/* Master Power Bar: ALL ON / ALL OFF */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={handleAllOn}
                className={`py-3 px-4 rounded-2xl font-black text-xs tracking-wider flex items-center justify-center gap-1.5 transition transform active:scale-95 shadow-md cursor-pointer border ${
                  isDark
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50 shadow-emerald-950/50"
                    : "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-emerald-200/50"
                }`}
              >
                <span className="text-sm">⚡</span> ALL ON (1+2)
              </button>

              <button
                onClick={handleAllOff}
                className={`py-3 px-4 rounded-2xl font-black text-xs tracking-wider flex items-center justify-center gap-1.5 transition transform active:scale-95 shadow-md cursor-pointer border ${
                  isDark
                    ? "bg-rose-950/40 border-rose-500/40 text-rose-400 hover:bg-rose-900/50 shadow-rose-950/50"
                    : "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100 shadow-rose-200/50"
                }`}
              >
                <span className="text-sm">⭕</span> ALL OFF (0+3)
              </button>
            </div>

            {/* Physical Button Bezel - LED 1 (Pin 2) */}
            <div
              className={`rounded-3xl p-5 mb-5 border transition-all ${
                isDark
                  ? "bg-zinc-950/80 border-zinc-800/90 shadow-inner"
                  : "bg-slate-100/90 border-slate-200 shadow-inner"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                      led1On
                        ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,1)] ring-2 ring-emerald-300"
                        : isDark
                        ? "bg-zinc-800 border border-zinc-700"
                        : "bg-slate-300 border border-slate-400"
                    }`}
                  />
                  <div>
                    <h2 className="text-sm font-black tracking-tight">CHANNEL 1 • LED 1</h2>
                    <p className={`text-[10px] font-bold ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
                      Pin D2 • Command: 1 / 0
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-full border ${
                    led1On
                      ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                      : isDark
                      ? "bg-zinc-900 text-zinc-500 border-zinc-800"
                      : "bg-white text-slate-400 border-slate-300"
                  }`}
                >
                  {led1On ? "STATE: ON" : "STATE: OFF"}
                </span>
              </div>

              {/* Physical Tactile Buttons for LED 1 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendCommand("1")}
                  className={`py-4 px-3 rounded-2xl font-black text-sm tracking-wider uppercase transition-all duration-150 transform active:scale-95 shadow-lg cursor-pointer border ${
                    led1On
                      ? "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/50 ring-4 ring-emerald-400/30"
                      : isDark
                      ? "bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border-zinc-700 shadow-black/40"
                      : "bg-white hover:bg-slate-50 text-emerald-600 border-slate-300 shadow-slate-300/80"
                  }`}
                >
                  ON (&apos;1&apos;)
                </button>

                <button
                  onClick={() => sendCommand("0")}
                  className={`py-4 px-3 rounded-2xl font-black text-sm tracking-wider uppercase transition-all duration-150 transform active:scale-95 shadow-lg cursor-pointer border ${
                    !led1On
                      ? isDark
                        ? "bg-zinc-900/90 text-zinc-600 border-zinc-800"
                        : "bg-slate-200/90 text-slate-400 border-slate-300"
                      : "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/40"
                  }`}
                >
                  OFF (&apos;0&apos;)
                </button>
              </div>
            </div>

            {/* Physical Button Bezel - LED 2 (Pin 3) */}
            <div
              className={`rounded-3xl p-5 border transition-all ${
                isDark
                  ? "bg-zinc-950/80 border-zinc-800/90 shadow-inner"
                  : "bg-slate-100/90 border-slate-200 shadow-inner"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                      led2On
                        ? "bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,1)] ring-2 ring-cyan-300"
                        : isDark
                        ? "bg-zinc-800 border border-zinc-700"
                        : "bg-slate-300 border border-slate-400"
                    }`}
                  />
                  <div>
                    <h2 className="text-sm font-black tracking-tight">CHANNEL 2 • LED 2</h2>
                    <p className={`text-[10px] font-bold ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
                      Pin D3 • Command: 2 / 3
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-full border ${
                    led2On
                      ? "bg-cyan-500/20 text-cyan-500 border-cyan-500/30"
                      : isDark
                      ? "bg-zinc-900 text-zinc-500 border-zinc-800"
                      : "bg-white text-slate-400 border-slate-300"
                  }`}
                >
                  {led2On ? "STATE: ON" : "STATE: OFF"}
                </span>
              </div>

              {/* Physical Tactile Buttons for LED 2 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendCommand("2")}
                  className={`py-4 px-3 rounded-2xl font-black text-sm tracking-wider uppercase transition-all duration-150 transform active:scale-95 shadow-lg cursor-pointer border ${
                    led2On
                      ? "bg-cyan-500 text-white border-cyan-400 shadow-cyan-500/50 ring-4 ring-cyan-400/30"
                      : isDark
                      ? "bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border-zinc-700 shadow-black/40"
                      : "bg-white hover:bg-slate-50 text-cyan-600 border-slate-300 shadow-slate-300/80"
                  }`}
                >
                  ON (&apos;2&apos;)
                </button>

                <button
                  onClick={() => sendCommand("3")}
                  className={`py-4 px-3 rounded-2xl font-black text-sm tracking-wider uppercase transition-all duration-150 transform active:scale-95 shadow-lg cursor-pointer border ${
                    !led2On
                      ? isDark
                        ? "bg-zinc-900/90 text-zinc-600 border-zinc-800"
                        : "bg-slate-200/90 text-slate-400 border-slate-300"
                      : "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/40"
                  }`}
                >
                  OFF (&apos;3&apos;)
                </button>
              </div>
            </div>

            {/* Last Action Bar at base of remote */}
            <div
              className={`mt-6 pt-3 border-t flex items-center justify-between text-[11px] font-mono ${
                isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-slate-500"
              }`}
            >
              <span>{lastAction ? `TX > ${lastAction}` : "Ready for input"}</span>
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
            className={`rounded-3xl border p-4 sm:p-5 space-y-3 transition-all shadow-xl ${
              isDark
                ? "bg-zinc-900/95 border-zinc-800"
                : "bg-white border-slate-200 shadow-slate-200"
            }`}
          >
            {/* Terminal Top Control Bar */}
            <div
              className={`flex items-center justify-between pb-3 border-b text-xs ${
                isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-slate-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold flex items-center gap-1.5 text-xs text-blue-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  TERMINAL
                </span>
                <span className="text-[10px] font-mono text-zinc-400">9600 Baud</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Hex / ASCII mode */}
                <button
                  onClick={() => setDisplayMode(displayMode === "ascii" ? "hex" : "ascii")}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
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
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono border focus:outline-none ${
                    isDark
                      ? "bg-zinc-950 border-zinc-800 text-zinc-300"
                      : "bg-slate-100 border-slate-300 text-slate-700"
                  }`}
                >
                  <option value="none">No Ending</option>
                  <option value="nl">\n (LF)</option>
                  <option value="crnl">\r\n (CRLF)</option>
                  <option value="cr">\r (CR)</option>
                </select>

                <button
                  onClick={() => setMessages([])}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    isDark
                      ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Terminal Viewport Screen */}
            <div className="h-64 sm:h-80 overflow-y-auto rounded-2xl bg-black/95 p-3.5 font-mono text-xs space-y-1.5 border border-zinc-800 shadow-inner text-emerald-400">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-1 select-none text-center">
                  <p className="text-zinc-500 font-medium">Serial Terminal Screen Ready.</p>
                  <p className="text-[11px] text-zinc-600">
                    Commands sent from the Remote tab or typed below appear here live.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  if (m.type === "tx") {
                    return (
                      <div key={m.id} className="flex items-start gap-2 text-blue-400">
                        <span className="text-zinc-600 text-[10px] select-none">{m.timestamp}</span>
                        <span className="text-blue-500 font-bold select-none">TX &gt;</span>
                        <span className="text-blue-300 font-semibold break-all">{m.text}</span>
                      </div>
                    );
                  }
                  if (m.type === "rx") {
                    return (
                      <div key={m.id} className="flex items-start gap-2 text-emerald-400">
                        <span className="text-zinc-600 text-[10px] select-none">{m.timestamp}</span>
                        <span className="text-emerald-500 font-bold select-none">RX &lt;</span>
                        <span className="text-emerald-300 break-all">{m.text}</span>
                      </div>
                    );
                  }
                  if (m.type === "error") {
                    return (
                      <div key={m.id} className="flex items-start gap-2 text-rose-400">
                        <span className="text-zinc-600 text-[10px] select-none">{m.timestamp}</span>
                        <span className="text-rose-500 font-bold select-none">[ERR]</span>
                        <span className="break-all">{m.text}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="flex items-start gap-2 text-amber-400/90 italic">
                      <span className="text-zinc-600 text-[10px] select-none">{m.timestamp}</span>
                      <span className="text-amber-500 font-bold select-none">[SYS]</span>
                      <span className="break-all">{m.text}</span>
                    </div>
                  );
                })
              )}
              <div ref={terminalBottomRef} />
            </div>

            {/* Quick Macro Shortcuts */}
            <div className="flex flex-wrap gap-2 pt-1 items-center">
              <span className={`text-[11px] font-bold ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                Quick Macros:
              </span>
              <button
                onClick={() => sendCommand("1")}
                className="px-2.5 py-1 rounded-lg bg-emerald-600/10 text-emerald-600 border border-emerald-500/30 text-xs font-mono font-bold hover:bg-emerald-600/20 cursor-pointer"
              >
                M1: 1
              </button>
              <button
                onClick={() => sendCommand("0")}
                className="px-2.5 py-1 rounded-lg bg-rose-600/10 text-rose-600 border border-rose-500/30 text-xs font-mono font-bold hover:bg-rose-600/20 cursor-pointer"
              >
                M2: 0
              </button>
              <button
                onClick={() => sendCommand("2")}
                className="px-2.5 py-1 rounded-lg bg-cyan-600/10 text-cyan-600 border border-cyan-500/30 text-xs font-mono font-bold hover:bg-cyan-600/20 cursor-pointer"
              >
                M3: 2
              </button>
              <button
                onClick={() => sendCommand("3")}
                className="px-2.5 py-1 rounded-lg bg-rose-600/10 text-rose-600 border border-rose-500/30 text-xs font-mono font-bold hover:bg-rose-600/20 cursor-pointer"
              >
                M4: 3
              </button>
            </div>

            {/* Command Send Bar */}
            <form onSubmit={handleFormSubmit} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Type command (1, 0, 2, 3, AT, etc.)..."
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                className={`flex-1 rounded-xl border px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-500 transition ${
                  isDark
                    ? "bg-zinc-950 border-zinc-800 text-white placeholder-zinc-600"
                    : "bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400"
                }`}
              />
              <button
                type="submit"
                disabled={!inputCommand.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Footer */}
        <footer className={`text-center text-xs pb-4 ${isDark ? "text-zinc-600" : "text-slate-400"}`}>
          Arduino Nano Dual LED Remote • Pin 2 (LED 1) & Pin 3 (LED 2)
        </footer>
      </div>
    </main>
  );
}
