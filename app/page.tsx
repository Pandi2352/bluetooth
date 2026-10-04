"use client";

import React, { useState, useEffect, useCallback } from "react";

interface BluetoothDeviceItem {
  id: string;
  name: string;
  type: string;
  isHC05: boolean;
  status: string;
  port?: string;
}

export default function Home() {
  const [devices, setDevices] = useState<BluetoothDeviceItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  // 4 Button States
  const [led1On, setLed1On] = useState(false); // Pin 2 ('1' = ON, '0' = OFF)
  const [led2On, setLed2On] = useState(false); // Pin 3 ('2' = ON, '3' = OFF)
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showPairGuide, setShowPairGuide] = useState(false);

  // Scan Bluetooth Devices from Next.js backend (NO browser popups)
  const scanDevices = useCallback(async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/bluetooth/scan");
      const data = await res.json();
      if (data.success && data.devices) {
        setDevices(data.devices);
      }
    } catch {
      // Ignore background scan error
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    scanDevices();
    const interval = setInterval(scanDevices, 4000);
    return () => clearInterval(interval);
  }, [scanDevices]);

  // Connect to HC-05 directly in the UI
  const handleConnectHC05 = async (targetDevice?: BluetoothDeviceItem) => {
    setIsConnecting(true);
    setStatusMessage("Connecting to HC-05 over Bluetooth...");

    try {
      const portsRes = await fetch("/api/ports");
      const portsData = await portsRes.json();

      const btPort = portsData.devices?.find(
        (p: any) =>
          p.type === "bluetooth" ||
          p.name.toLowerCase().includes("bluetooth") ||
          p.name.toLowerCase().includes("bth") ||
          p.name.toLowerCase().includes("hc-05")
      );

      const portToUse = targetDevice?.port || btPort?.path || portsData.devices?.[0]?.path;

      if (!portToUse) {
        setStatusMessage(
          "HC-05 is not paired with Windows yet. Click 'Pair HC-05 (PIN: 1234)' to pair it once."
        );
        setShowPairGuide(true);
        setIsConnecting(false);
        return;
      }

      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", port: portToUse, baudRate: 9600 }),
      });
      const data = await res.json();

      if (data.success) {
        setIsConnected(true);
        setConnectedDevice(targetDevice?.name || "HC-05 Bluetooth");
        setStatusMessage("Connected wirelessly to HC-05!");
        setShowPairGuide(false);
      } else {
        setStatusMessage(data.error || "Could not connect to HC-05. Please pair it first.");
        setShowPairGuide(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connect failed";
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    try {
      await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
    } catch {
      // Ignore
    }
    setIsConnected(false);
    setConnectedDevice(null);
    setStatusMessage("Disconnected from HC-05.");
  };

  // Open Windows Bluetooth Pairing Settings directly on desktop
  const handlePairHC05 = async () => {
    setStatusMessage("Opening Windows Bluetooth Settings... Select 'HC-05' and enter PIN: 1234");
    setShowPairGuide(true);
    // Direct protocol launch from browser to open Windows Bluetooth Settings
    try {
      window.location.href = "ms-settings:bluetooth";
    } catch {
      // Ignore
    }
    // Also trigger via backend Start-Process
    fetch("/api/bluetooth/pair", { method: "POST" });
  };

  // Send Remote Commands ('1', '0', '2', '3')
  const sendCommand = async (cmd: "1" | "0" | "2" | "3") => {
    if (cmd === "1") {
      setLed1On(true);
      setLastCommand("Sent '1' → LED 1 ON");
    } else if (cmd === "0") {
      setLed1On(false);
      setLastCommand("Sent '0' → LED 1 OFF");
    } else if (cmd === "2") {
      setLed2On(true);
      setLastCommand("Sent '2' → LED 2 ON");
    } else if (cmd === "3") {
      setLed2On(false);
      setLastCommand("Sent '3' → LED 2 OFF");
    }

    try {
      await fetch("/api/led", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Send failed";
      setStatusMessage(`Error: ${msg}`);
    }
  };

  // Master Actions
  const handleAllOn = async () => {
    await sendCommand("1");
    setTimeout(() => sendCommand("2"), 150);
  };

  const handleAllOff = async () => {
    await sendCommand("0");
    setTimeout(() => sendCommand("3"), 150);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md space-y-4">
        
        {/* Remote Controller Card */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-2xl p-6 relative overflow-hidden backdrop-blur">
          
          {/* Subtle Ambient Glow */}
          <div
            className={`absolute -top-14 -right-14 w-44 h-44 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
              led1On || led2On ? "bg-emerald-500/20" : "bg-blue-600/15"
            }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
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
                  Wireless Remote
                </p>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
                HC-05 Bluetooth Remote
              </h1>
            </div>

            {/* Live Connection Pill */}
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium border transition-all ${
                isConnected
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  : "bg-zinc-800/80 text-zinc-400 border-zinc-700"
              }`}
            >
              {isConnected ? "● Connected" : "○ Disconnected"}
            </span>
          </div>

          {/* Bluetooth Connection Bar */}
          <div className="mb-5 p-3.5 rounded-2xl border border-zinc-800 bg-zinc-950/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m7 7 10 10-5 5V2l5 5L7 17" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  {isConnected ? connectedDevice : "HC-05 Bluetooth"}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {isConnected ? "Wireless link active" : "Battery powered"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {!isConnected ? (
                <>
                  <button
                    onClick={() => handleConnectHC05()}
                    disabled={isConnecting}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
                  >
                    {isConnecting ? "Connecting..." : "Connect"}
                  </button>
                  <button
                    onClick={handlePairHC05}
                    title="Pair with PIN 1234 in Windows"
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-blue-400 text-xs font-semibold border border-zinc-700 transition cursor-pointer"
                  >
                    Pair HC-05
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-semibold transition cursor-pointer"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Quick Pairing Helper Card (Only shows when needed or clicked) */}
          {showPairGuide && !isConnected && (
            <div className="mb-5 p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/30 text-xs text-zinc-300 space-y-2">
              <div className="flex items-center justify-between text-blue-300 font-semibold">
                <span>Pairing HC-05 to Windows (PIN: 1234)</span>
                <button onClick={() => setShowPairGuide(false)} className="text-zinc-500 hover:text-white">✕</button>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-400 leading-relaxed">
                <li>Click <span className="text-blue-300 font-medium">Add device</span> in the Windows Bluetooth window.</li>
                <li>Choose <span className="text-white font-medium">Bluetooth</span> and select <span className="text-white font-medium">HC-05</span>.</li>
                <li>Enter PIN: <span className="text-emerald-400 font-mono font-bold">1234</span> (or <span className="text-emerald-400 font-mono">0000</span>) and click Connect.</li>
                <li>Return here and click <span className="text-blue-400 font-semibold">Connect</span>!</li>
              </ol>
              <button
                onClick={handlePairHC05}
                className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                Open Windows Bluetooth Settings Now
              </button>
            </div>
          )}

          {/* 4 BUTTON CONTROLLER */}
          <div className="space-y-4">
            
            {/* LED 1 SECTION (Pin 2) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                      led1On
                        ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,1)]"
                        : "bg-zinc-700"
                    }`}
                  />
                  <div>
                    <h2 className="text-sm font-bold text-white">LED 1 (Pin 2)</h2>
                    <p className="text-[11px] text-zinc-400">
                      Status:{" "}
                      <span className={led1On ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
                        {led1On ? "ON" : "OFF"}
                      </span>
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  Cmd 1 / 0
                </span>
              </div>

              {/* 2 Buttons for LED 1 */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => sendCommand("1")}
                  className={`py-3.5 px-4 rounded-xl text-xs font-bold tracking-wide transition-all transform active:scale-95 shadow cursor-pointer ${
                    led1On
                      ? "bg-emerald-500 text-white shadow-emerald-900/40 ring-2 ring-emerald-400/50"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  LED 1 ON (&apos;1&apos;)
                </button>

                <button
                  onClick={() => sendCommand("0")}
                  className={`py-3.5 px-4 rounded-xl text-xs font-bold tracking-wide transition-all transform active:scale-95 shadow cursor-pointer ${
                    !led1On
                      ? "bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40"
                  }`}
                >
                  LED 1 OFF (&apos;0&apos;)
                </button>
              </div>
            </div>

            {/* LED 2 SECTION (Pin 3) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                      led2On
                        ? "bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,1)]"
                        : "bg-zinc-700"
                    }`}
                  />
                  <div>
                    <h2 className="text-sm font-bold text-white">LED 2 (Pin 3)</h2>
                    <p className="text-[11px] text-zinc-400">
                      Status:{" "}
                      <span className={led2On ? "text-cyan-400 font-semibold" : "text-zinc-500"}>
                        {led2On ? "ON" : "OFF"}
                      </span>
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  Cmd 2 / 3
                </span>
              </div>

              {/* 2 Buttons for LED 2 */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => sendCommand("2")}
                  className={`py-3.5 px-4 rounded-xl text-xs font-bold tracking-wide transition-all transform active:scale-95 shadow cursor-pointer ${
                    led2On
                      ? "bg-cyan-500 text-white shadow-cyan-900/40 ring-2 ring-cyan-400/50"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  LED 2 ON (&apos;2&apos;)
                </button>

                <button
                  onClick={() => sendCommand("3")}
                  className={`py-3.5 px-4 rounded-xl text-xs font-bold tracking-wide transition-all transform active:scale-95 shadow cursor-pointer ${
                    !led2On
                      ? "bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40"
                  }`}
                >
                  LED 2 OFF (&apos;3&apos;)
                </button>
              </div>
            </div>

            {/* Master All ON / All OFF Quick Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={handleAllOn}
                className="py-2.5 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition cursor-pointer"
              >
                ⚡ ALL ON (1 + 2)
              </button>
              <button
                onClick={handleAllOff}
                className="py-2.5 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 transition cursor-pointer"
              >
                🌙 ALL OFF (0 + 3)
              </button>
            </div>
          </div>

          {/* Last Sent Feedback Indicator */}
          {lastCommand && (
            <div className="mt-4 p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs text-zinc-300 font-mono">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                {lastCommand}
              </span>
              <span className="text-[10px] text-zinc-500">HC-05 TX</span>
            </div>
          )}

          {statusMessage && (
            <div className="mt-3 p-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700 text-xs text-zinc-300 flex items-center justify-between">
              <span>{statusMessage}</span>
              <button onClick={() => setStatusMessage(null)} className="text-zinc-500 hover:text-white ml-2">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-500">
          Nano on Battery • Pin 2 (LED 1) & Pin 3 (LED 2) • Commands 1, 0, 2, 3
        </div>
      </div>
    </main>
  );
}
