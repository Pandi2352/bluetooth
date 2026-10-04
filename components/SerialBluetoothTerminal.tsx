"use client";

import React, { useState, useEffect, useRef } from "react";

interface TerminalMessage {
  id: string;
  type: "tx" | "rx" | "system" | "error";
  text: string;
  timestamp: string;
}

export default function SerialBluetoothTerminal() {
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [portName, setPortName] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [connectionType, setConnectionType] = useState<"webserial" | "backend">("webserial");

  // Terminal states
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [inputCommand, setInputCommand] = useState("");
  const [lineEnding, setLineEnding] = useState<"none" | "nl" | "crnl">("none");
  const [autoScroll, setAutoScroll] = useState(true);
  const [ledState, setLedState] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Web Serial API handles
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const readableStreamClosedRef = useRef<any>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Check browser support for Web Serial API
  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported = "serial" in navigator;
      setIsSupported(supported);
      if (!supported) {
        setConnectionType("backend");
      }
    }
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

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

  // Start reading incoming data from Web Serial
  const startReading = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    readableStreamClosedRef.current = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        if (value) {
          buffer += value;
          // Split by newline if present or buffer chunks
          if (buffer.includes("\n")) {
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const clean = line.replace("\r", "").trim();
              if (clean) {
                addMessage(clean, "rx");
                // Auto sync LED status if Arduino replies
                if (clean.toLowerCase().includes("on")) setLedState(true);
                if (clean.toLowerCase().includes("off")) setLedState(false);
              }
            }
          } else if (buffer.length > 50) {
            addMessage(buffer, "rx");
            buffer = "";
          }
        }
      }
    } catch (err: unknown) {
      if (isConnected) {
        addMessage(`Read error: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }
  };

  // Connect via Browser Web Serial (Direct to HC-05)
  const connectWebSerial = async () => {
    if (!("serial" in navigator)) {
      addMessage("Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.", "error");
      return;
    }

    try {
      setIsConnecting(true);
      addMessage("Opening Bluetooth / Serial device picker...", "system");

      // Browser pops up device selector for HC-05 Bluetooth SPP / COM
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      portRef.current = port;
      const info = port.getInfo ? port.getInfo() : {};
      const devTitle = info.usbVendorId ? `USB Device (VID: ${info.usbVendorId.toString(16)})` : "HC-05 Bluetooth SPP";
      setPortName(devTitle);
      setIsConnected(true);
      setConnectionType("webserial");
      addMessage(`Connected to ${devTitle} at ${baudRate} baud.`, "system");

      // Start asynchronous read loop
      startReading(port);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "User cancelled selection or connection failed";
      addMessage(`Connection failed: ${msg}`, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect via Next.js Backend (Fallback)
  const connectBackend = async () => {
    try {
      setIsConnecting(true);
      addMessage("Scanning and connecting via Next.js backend...", "system");
      const portsRes = await fetch("/api/ports");
      const portsData = await portsRes.json();
      const firstPort = portsData.devices?.[0]?.path;

      if (!firstPort) {
        addMessage("No COM port found on host system.", "error");
        return;
      }

      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", port: firstPort, baudRate }),
      });
      const data = await res.json();
      if (data.success) {
        setIsConnected(true);
        setPortName(firstPort);
        setConnectionType("backend");
        addMessage(`Backend connected to ${firstPort} at ${baudRate} baud.`, "system");
      } else {
        addMessage(`Backend connection failed: ${data.error}`, "error");
      }
    } catch (err: unknown) {
      addMessage(`Backend error: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect cleanly
  const disconnect = async () => {
    if (connectionType === "webserial") {
      try {
        if (readerRef.current) {
          await readerRef.current.cancel();
          readerRef.current = null;
        }
        if (readableStreamClosedRef.current) {
          await readableStreamClosedRef.current.catch(() => {});
          readableStreamClosedRef.current = null;
        }
        if (portRef.current) {
          await portRef.current.close();
          portRef.current = null;
        }
        setIsConnected(false);
        setPortName(null);
        addMessage("Disconnected from Bluetooth device.", "system");
      } catch (err: unknown) {
        addMessage(`Disconnect error: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    } else {
      // Backend disconnect
      try {
        await fetch("/api/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "disconnect" }),
        });
        setIsConnected(false);
        setPortName(null);
        addMessage("Disconnected from backend serial port.", "system");
      } catch (err: unknown) {
        addMessage(`Backend disconnect error: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }
  };

  // Send raw string over the serial connection
  const sendData = async (raw: string) => {
    if (!isConnected) {
      addMessage("Cannot send: terminal not connected.", "error");
      return;
    }

    let payload = raw;
    if (lineEnding === "nl") payload += "\n";
    else if (lineEnding === "crnl") payload += "\r\n";

    if (connectionType === "webserial" && portRef.current?.writable) {
      try {
        const textEncoder = new TextEncoder();
        const writer = portRef.current.writable.getWriter();
        await writer.write(textEncoder.encode(payload));
        writer.releaseLock();
        addMessage(raw, "tx");
      } catch (err: unknown) {
        addMessage(`Send error: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    } else {
      // Send via backend
      try {
        const res = await fetch("/api/led", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: raw === "1" }),
        });
        const data = await res.json();
        if (data.success) {
          addMessage(raw, "tx");
          setLedState(raw === "1");
        } else {
          addMessage(`Backend send error: ${data.error}`, "error");
        }
      } catch (err: unknown) {
        addMessage(`Send error: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }
  };

  // Toggle LED helper
  const toggleLed = () => {
    const next = !ledState;
    setLedState(next);
    sendData(next ? "1" : "0");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;
    sendData(inputCommand);
    setInputCommand("");
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 font-sans">
      
      {/* Top Remote Control & LED Status Widget */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/95 shadow-2xl p-6 relative overflow-hidden backdrop-blur">
        <div
          className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            ledState ? "bg-emerald-500/25" : "bg-blue-600/10"
          }`}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isConnected ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isConnected ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </span>
              <p className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
                Arduino Nano + HC-05
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Serial Bluetooth Terminal
            </h1>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-3 py-1.5 rounded-full font-medium border ${
                isConnected
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : "bg-zinc-800/80 text-zinc-400 border-zinc-700"
              }`}
            >
              {isConnected ? `● Connected: ${portName}` : "○ Disconnected"}
            </span>
          </div>
        </div>

        {/* LED State Card & Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/80 px-5 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                LED Status
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {ledState ? "ON" : "OFF"}
              </p>
            </div>
            <div
              className={`h-5 w-5 rounded-full transition-all duration-300 ${
                ledState
                  ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,1)]"
                  : "bg-zinc-700"
              }`}
            />
          </div>

          <button
            onClick={toggleLed}
            disabled={!isConnected}
            className={`rounded-2xl py-4 px-6 text-lg font-bold tracking-wide transition-all transform active:scale-98 shadow-lg cursor-pointer ${
              !isConnected
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : ledState
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
            }`}
          >
            {ledState ? "Turn OFF ('0')" : "Turn ON ('1')"}
          </button>
        </div>

        {/* Connection Action Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-800/80">
          {!isConnected ? (
            <>
              <button
                onClick={connectWebSerial}
                disabled={isConnecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition cursor-pointer disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m7 7 10 10-5 5V2l5 5L7 17" />
                </svg>
                {isConnecting ? "Connecting..." : "Connect Bluetooth (HC-05)"}
              </button>

              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                <option value={9600}>9600 Baud (Standard HC-05)</option>
                <option value={38400}>38400 Baud (AT Mode)</option>
                <option value={115200}>115200 Baud</option>
              </select>

              {!isSupported && (
                <button
                  onClick={connectBackend}
                  disabled={isConnecting}
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                >
                  Connect via Backend
                </button>
              )}
            </>
          ) : (
            <button
              onClick={disconnect}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-semibold transition cursor-pointer"
            >
              Disconnect
            </button>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
            <span>Terminal</span>
            <button
              onClick={() => setMessages([])}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Display Screen */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/95 shadow-2xl p-4 sm:p-6 space-y-4">
        
        {/* Terminal Header */}
        <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-zinc-300 font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              SERIAL MONITOR
            </span>
            <span className="text-[11px] text-zinc-500">
              {isConnected ? `${baudRate} 8-N-1` : "Offline"}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0"
              />
              Autoscroll
            </label>

            <select
              value={lineEnding}
              onChange={(e) => setLineEnding(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-300"
            >
              <option value="none">No Ending</option>
              <option value="nl">Newline (\n)</option>
              <option value="crnl">CR+LF (\r\n)</option>
            </select>
          </div>
        </div>

        {/* Terminal Console Viewport */}
        <div className="h-64 sm:h-80 overflow-y-auto rounded-2xl bg-black/90 p-4 font-mono text-xs space-y-1.5 border border-zinc-800/80 shadow-inner">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-1">
              <p className="text-zinc-500">Serial Bluetooth Terminal Ready.</p>
              <p className="text-[11px]">
                Click &quot;Connect Bluetooth (HC-05)&quot; to begin wireless transmission.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              if (m.type === "tx") {
                return (
                  <div key={m.id} className="flex items-start gap-2 text-blue-400">
                    <span className="text-zinc-600 text-[10px] select-none font-mono">
                      {m.timestamp}
                    </span>
                    <span className="text-blue-500 select-none font-bold">TX &gt;</span>
                    <span className="text-blue-300 font-semibold break-all">{m.text}</span>
                  </div>
                );
              }
              if (m.type === "rx") {
                return (
                  <div key={m.id} className="flex items-start gap-2 text-emerald-400">
                    <span className="text-zinc-600 text-[10px] select-none font-mono">
                      {m.timestamp}
                    </span>
                    <span className="text-emerald-500 select-none font-bold">RX &lt;</span>
                    <span className="text-emerald-300 break-all">{m.text}</span>
                  </div>
                );
              }
              if (m.type === "error") {
                return (
                  <div key={m.id} className="flex items-start gap-2 text-rose-400">
                    <span className="text-zinc-600 text-[10px] select-none font-mono">
                      {m.timestamp}
                    </span>
                    <span className="text-rose-500 font-bold select-none">[ERR]</span>
                    <span className="break-all">{m.text}</span>
                  </div>
                );
              }
              return (
                <div key={m.id} className="flex items-start gap-2 text-amber-400/90 italic">
                  <span className="text-zinc-600 text-[10px] select-none font-mono">
                    {m.timestamp}
                  </span>
                  <span className="text-amber-500 font-bold select-none">[SYS]</span>
                  <span className="break-all">{m.text}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Quick Macro Buttons (M1 - M4) */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-xs text-zinc-500 self-center mr-1">Quick Send:</span>
          <button
            onClick={() => sendData("1")}
            disabled={!isConnected}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-emerald-400 font-mono text-xs transition cursor-pointer disabled:opacity-50"
          >
            M1: &apos;1&apos; (LED ON)
          </button>
          <button
            onClick={() => sendData("0")}
            disabled={!isConnected}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-rose-400 font-mono text-xs transition cursor-pointer disabled:opacity-50"
          >
            M2: &apos;0&apos; (LED OFF)
          </button>
          <button
            onClick={() => sendData("PING")}
            disabled={!isConnected}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 font-mono text-xs transition cursor-pointer disabled:opacity-50"
          >
            M3: PING
          </button>
          <button
            onClick={() => sendData("STATUS")}
            disabled={!isConnected}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 font-mono text-xs transition cursor-pointer disabled:opacity-50"
          >
            M4: STATUS
          </button>
        </div>

        {/* Command Input Bar */}
        <form onSubmit={handleFormSubmit} className="flex gap-2 pt-2">
          <input
            type="text"
            placeholder={
              isConnected
                ? "Type command to send (e.g. 1 or 0)..."
                : "Connect to HC-05 to enable terminal input"
            }
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            disabled={!isConnected}
            className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isConnected || !inputCommand.trim()}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      {/* Helpful Info Guide */}
      <div className="text-center text-xs text-zinc-500 space-y-1">
        <p>
          Runs client-side via Chrome/Edge <span className="text-zinc-300">Web Serial API</span> • Native Bluetooth SPP support
        </p>
        <p className="text-[11px] text-zinc-600">
          Ensure your HC-05 is paired to Windows (PIN: 1234) before opening the selector.
        </p>
      </div>
    </div>
  );
}
