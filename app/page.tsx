"use client";

import React, { useState, useEffect, useRef } from "react";

interface TerminalMessage {
  id: string;
  type: "tx" | "rx" | "system" | "error";
  text: string;
  timestamp: string;
}

export default function Home() {
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<"webbluetooth" | "webserial" | "backend" | null>(null);

  // Terminal Console states
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [inputCommand, setInputCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lineEnding, setLineEnding] = useState<"none" | "nl" | "crnl" | "cr">("none");
  const [displayMode, setDisplayMode] = useState<"ascii" | "hex">("ascii");
  const [autoScroll, setAutoScroll] = useState(true);

  // Dual LED states
  const [led1On, setLed1On] = useState(false); // Pin 2 ('1' = ON, '0' = OFF)
  const [led2On, setLed2On] = useState(false); // Pin 3 ('2' = ON, '3' = OFF)

  // Hardware references
  const gattTxCharRef = useRef<any>(null);
  const gattDeviceRef = useRef<any>(null);
  const serialPortRef = useRef<any>(null);
  const serialWriterRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Add message to terminal
  const addMessage = (text: string, type: "tx" | "rx" | "system" | "error") => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setMessages((prev) => [
      ...prev.slice(-300), // Keep last 300 messages
      { id: Math.random().toString(36).substring(2, 9), type, text, timestamp },
    ]);
  };

  // Convert string to Hex representation
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

  // Connect via Web Bluetooth (Standard for Mobile Chrome & Web)
  const connectWebBluetooth = async () => {
    if (typeof window === "undefined" || !("bluetooth" in navigator)) {
      addMessage("Web Bluetooth API is not supported in this browser. Please use Chrome on Android or Desktop.", "error");
      return;
    }

    try {
      setIsConnecting(true);
      addMessage("Scanning for Bluetooth devices...", "system");

      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 BLE Service
          "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service
          "generic_access",
        ],
      });

      addMessage(`Connecting to GATT server on ${device.name || "Device"}...`, "system");
      const server = await device.gatt.connect();
      gattDeviceRef.current = device;

      // Handle disconnect
      device.addEventListener("gattserverdisconnected", () => {
        setIsConnected(false);
        setConnectedDeviceName(null);
        setConnectionType(null);
        addMessage("Bluetooth device disconnected.", "system");
      });

      // Find UART service and characteristics
      let txChar: any = null;
      let rxChar: any = null;

      try {
        // Try HM-10 service
        const hm10Service = await server.getPrimaryService("0000ffe0-0000-1000-8000-00805f9b34fb").catch(() => null);
        if (hm10Service) {
          txChar = await hm10Service.getCharacteristic("0000ffe1-0000-1000-8000-00805f9b34fb").catch(() => null);
          rxChar = txChar;
        }

        // Try Nordic UART service if not HM-10
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

        // Enable notifications for incoming RX
        if (rxChar && rxChar.startNotifications) {
          await rxChar.startNotifications();
          rxChar.addEventListener("characteristicvaluechanged", (e: any) => {
            const val = new TextDecoder().decode(e.target.value);
            const clean = val.trim();
            if (clean) {
              addMessage(clean, "rx");
              if (clean.includes("1") || clean.toLowerCase().includes("on")) setLed1On(true);
              if (clean.includes("0") || clean.toLowerCase().includes("off")) setLed1On(false);
            }
          });
        }
      } catch (e: unknown) {
        addMessage(`Note: ${e instanceof Error ? e.message : String(e)}`, "system");
      }

      setIsConnected(true);
      setConnectedDeviceName(device.name || "Bluetooth Device");
      setConnectionType("webbluetooth");
      addMessage(`Connected successfully to ${device.name || "Bluetooth Device"}!`, "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "User cancelled or device not found";
      addMessage(`Connection note: ${msg}`, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect via Web Serial (Chromium Desktop Bluetooth SPP / COM)
  const connectWebSerial = async () => {
    if (typeof window === "undefined" || !("serial" in navigator)) {
      addMessage("Web Serial API not available. Use Web Bluetooth or Backend mode.", "error");
      return;
    }

    try {
      setIsConnecting(true);
      addMessage("Opening Serial Port picker...", "system");

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      serialPortRef.current = port;

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      serialWriterRef.current = textEncoder.writable.getWriter();

      // Start asynchronous read loop
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
      setConnectedDeviceName("HC-05 Serial Port");
      setConnectionType("webserial");
      addMessage("Connected via Web Serial at 9600 baud!", "system");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cancelled";
      addMessage(`Serial error: ${msg}`, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect cleanly
  const handleDisconnect = async () => {
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
      // Backend disconnect
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

  // Transmit command to Bluetooth / Serial Terminal
  const sendCommand = async (rawCmd: string) => {
    let payload = rawCmd;
    if (lineEnding === "nl") payload += "\n";
    else if (lineEnding === "crnl") payload += "\r\n";
    else if (lineEnding === "cr") payload += "\r";

    // Track internal LED status
    if (rawCmd === "1") setLed1On(true);
    else if (rawCmd === "0") setLed1On(false);
    else if (rawCmd === "2") setLed2On(true);
    else if (rawCmd === "3") setLed2On(false);

    // Save in history
    setCommandHistory((prev) => [rawCmd, ...prev.slice(0, 20)]);
    setHistoryIndex(-1);

    // Display in terminal
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

    // 3. Fallback: Next.js Backend Transmit
    try {
      const res = await fetch("/api/led", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: rawCmd }),
      });
      const data = await res.json();
      if (!data.success && isConnected) {
        addMessage(`Send note: ${data.message || data.error}`, "error");
      }
    } catch {
      // Backend offline or running purely client-side
    }
  };

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;
    sendCommand(inputCommand);
    setInputCommand("");
  };

  // Handle Command History (Up / Down arrow keys)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputCommand(commandHistory[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIdx = historyIndex - 1;
        setHistoryIndex(prevIdx);
        setInputCommand(commandHistory[prevIdx]);
      } else {
        setHistoryIndex(-1);
        setInputCommand("");
      }
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-start p-3 sm:p-6 font-sans">
      <div className="w-full max-w-2xl space-y-4">
        
        {/* Terminal Header & Connection Card */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-2xl p-5 sm:p-6 relative overflow-hidden backdrop-blur">
          <div
            className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
              led1On || led2On ? "bg-emerald-500/20" : "bg-blue-600/15"
            }`}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isConnected ? "bg-emerald-400" : "bg-blue-400"
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isConnected ? "bg-emerald-500" : "bg-blue-500"
                    }`}
                  />
                </span>
                <p className="text-xs uppercase tracking-wider font-semibold text-blue-400">
                  Wireless Serial Terminal
                </p>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
                Serial Bluetooth Terminal
              </h1>
            </div>

            {/* Connection Status Badge */}
            <span
              className={`self-start sm:self-auto text-xs px-3.5 py-1.5 rounded-full font-medium border transition-all ${
                isConnected
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                  : "bg-zinc-800/80 text-zinc-400 border-zinc-700"
              }`}
            >
              {isConnected ? `● Connected: ${connectedDeviceName}` : "○ Disconnected"}
            </span>
          </div>

          {/* Connection Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800">
            {!isConnected ? (
              <>
                <button
                  onClick={connectWebBluetooth}
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-900/30 cursor-pointer disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m7 7 10 10-5 5V2l5 5L7 17" />
                  </svg>
                  {isConnecting ? "Scanning..." : "Connect Bluetooth"}
                </button>

                <button
                  onClick={connectWebSerial}
                  disabled={isConnecting}
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition cursor-pointer"
                >
                  Serial Port / HC-05
                </button>
              </>
            ) : (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-bold transition cursor-pointer"
              >
                Disconnect
              </button>
            )}

            <div className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
              <button
                onClick={() => setMessages([])}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* 4 DEDICATED BUTTON MACROS & LED STATUS */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-xl p-5 space-y-4 backdrop-blur">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200 uppercase tracking-wider">
              Dual LED Remote (4 Buttons)
            </span>
            <span className="text-[11px] font-mono text-zinc-500">Pins: D2 & D3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            {/* LED 1 Panel (Pin 2) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full transition-all duration-300 ${
                      led1On
                        ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]"
                        : "bg-zinc-700"
                    }`}
                  />
                  <span className="text-xs font-bold text-white">LED 1 (Pin 2)</span>
                </div>
                <span className={`text-[10px] font-bold ${led1On ? "text-emerald-400" : "text-zinc-500"}`}>
                  {led1On ? "● ON" : "○ OFF"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => sendCommand("1")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition transform active:scale-95 shadow cursor-pointer ${
                    led1On
                      ? "bg-emerald-500 text-white shadow-emerald-900/40 ring-2 ring-emerald-400/50"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  LED 1 ON (&apos;1&apos;)
                </button>
                <button
                  onClick={() => sendCommand("0")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition transform active:scale-95 shadow cursor-pointer ${
                    !led1On
                      ? "bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40"
                  }`}
                >
                  LED 1 OFF (&apos;0&apos;)
                </button>
              </div>
            </div>

            {/* LED 2 Panel (Pin 3) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full transition-all duration-300 ${
                      led2On
                        ? "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1)]"
                        : "bg-zinc-700"
                    }`}
                  />
                  <span className="text-xs font-bold text-white">LED 2 (Pin 3)</span>
                </div>
                <span className={`text-[10px] font-bold ${led2On ? "text-cyan-400" : "text-zinc-500"}`}>
                  {led2On ? "● ON" : "○ OFF"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => sendCommand("2")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition transform active:scale-95 shadow cursor-pointer ${
                    led2On
                      ? "bg-cyan-500 text-white shadow-cyan-900/40 ring-2 ring-cyan-400/50"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  LED 2 ON (&apos;2&apos;)
                </button>
                <button
                  onClick={() => sendCommand("3")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition transform active:scale-95 shadow cursor-pointer ${
                    !led2On
                      ? "bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40"
                  }`}
                >
                  LED 2 OFF (&apos;3&apos;)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TERMINAL CONSOLE VIEWPORT */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/95 shadow-2xl p-4 sm:p-5 space-y-3">
          
          {/* Console Controls Bar */}
          <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-zinc-200 font-bold flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                SERIAL CONSOLE
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">9600 Baud</span>
            </div>

            <div className="flex items-center gap-3">
              {/* ASCII / HEX View Toggle */}
              <button
                onClick={() => setDisplayMode(displayMode === "ascii" ? "hex" : "ascii")}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-white"
              >
                {displayMode.toUpperCase()}
              </button>

              {/* Line Ending */}
              <select
                value={lineEnding}
                onChange={(e) => setLineEnding(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-[10px] text-zinc-300 focus:outline-none"
              >
                <option value="none">No Ending</option>
                <option value="nl">\n (LF)</option>
                <option value="crnl">\r\n (CRLF)</option>
                <option value="cr">\r (CR)</option>
              </select>

              {/* Autoscroll */}
              <label className="flex items-center gap-1 cursor-pointer text-[11px] text-zinc-400 select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0"
                />
                Scroll
              </label>
            </div>
          </div>

          {/* Terminal Screen */}
          <div className="h-60 sm:h-72 overflow-y-auto rounded-2xl bg-black/95 p-3.5 font-mono text-xs space-y-1.5 border border-zinc-800/80 shadow-inner">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-1 select-none">
                <p className="text-zinc-500 font-medium">Serial Bluetooth Terminal Ready.</p>
                <p className="text-[11px]">Tap buttons above or type commands below to transmit.</p>
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

          {/* Quick Macro Bar (M1 - M4) */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs text-zinc-500 self-center mr-1">Macros:</span>
            <button
              onClick={() => sendCommand("1")}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-emerald-400 font-mono text-[11px] transition cursor-pointer"
            >
              M1: 1
            </button>
            <button
              onClick={() => sendCommand("0")}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-rose-400 font-mono text-[11px] transition cursor-pointer"
            >
              M2: 0
            </button>
            <button
              onClick={() => sendCommand("2")}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-cyan-400 font-mono text-[11px] transition cursor-pointer"
            >
              M3: 2
            </button>
            <button
              onClick={() => sendCommand("3")}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-rose-400 font-mono text-[11px] transition cursor-pointer"
            >
              M4: 3
            </button>
          </div>

          {/* Command Input Bar */}
          <form onSubmit={handleFormSubmit} className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Type command (e.g. 1, 0, 2, 3, AT)..."
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!inputCommand.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-500">
          Serial Bluetooth Terminal • Nano on Battery • Pin 2 (LED 1) & Pin 3 (LED 2)
        </div>
      </div>
    </main>
  );
}
