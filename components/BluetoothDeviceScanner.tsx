"use client";

import React, { useState, useEffect, useCallback } from "react";

export interface BluetoothDeviceItem {
  id: string;
  name: string;
  type: string;
  isHC05: boolean;
  status: string;
  present: boolean;
  port?: string;
  source: string;
}

export default function BluetoothDeviceScanner() {
  const [devices, setDevices] = useState<BluetoothDeviceItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeDevice, setActiveDevice] = useState<BluetoothDeviceItem | null>(null);

  // Dual LED States
  const [led1State, setLed1State] = useState(false); // Pin 2 ('1' ON, '0' OFF)
  const [led2State, setLed2State] = useState(false); // Pin 3 ('2' ON, '3' OFF)

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [customCmd, setCustomCmd] = useState("");
  const [isPairingLoading, setIsPairingLoading] = useState(false);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 40)]);
  };

  // Scan Bluetooth devices from Next.js backend (NO browser popups)
  const scanBluetoothDevices = useCallback(async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/bluetooth/scan");
      const data = await res.json();
      if (data.success && data.devices) {
        setDevices(data.devices);
        addLog(`Discovered ${data.devices.length} Bluetooth devices on host.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setStatusMessage(`Scan error: ${msg}`);
      addLog(`Scan error: ${msg}`);
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    scanBluetoothDevices();
    const interval = setInterval(scanBluetoothDevices, 4000);
    return () => clearInterval(interval);
  }, [scanBluetoothDevices]);

  // Open Windows Device Pairing Wizard directly
  const handleOpenPairingWizard = async () => {
    setIsPairingLoading(true);
    setStatusMessage("Opening Windows Bluetooth Pairing Wizard...");
    addLog("Opening Windows Bluetooth Pairing Wizard (Select HC-05, enter PIN: 1234)...");
    try {
      const res = await fetch("/api/bluetooth/pair", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatusMessage("Pairing Wizard opened! Select HC-05 and enter PIN: 1234.");
        addLog("Pairing Wizard launched on desktop.");
      } else {
        setStatusMessage(data.error || "Failed to open wizard");
      }
    } catch {
      setStatusMessage("Failed to open pairing wizard");
    } finally {
      setIsPairingLoading(false);
    }
  };

  // Connect to a Bluetooth device (Purely via Next.js backend, NO browser serial popup!)
  const handleConnectDevice = async (device: BluetoothDeviceItem) => {
    setStatusMessage(`Connecting to ${device.name} over Bluetooth...`);
    addLog(`Initiating wireless Bluetooth connection to ${device.name}...`);

    try {
      const portsRes = await fetch("/api/ports");
      const portsData = await portsRes.json();
      
      const btPort = portsData.devices?.find(
        (p: any) =>
          p.type === "bluetooth" ||
          p.name.toLowerCase().includes("bluetooth") ||
          p.name.toLowerCase().includes("bth")
      );

      const portToUse = device.port || btPort?.path || portsData.devices?.[0]?.path;

      if (!portToUse) {
        setStatusMessage(
          "HC-05 is not paired with Windows yet. Click 'Pair HC-05 (PIN: 1234)' to pair it once."
        );
        addLog("HC-05 not paired yet. Please pair with Windows once.");
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
        setActiveDevice(device);
        setStatusMessage(`Connected wirelessly to ${device.name}!`);
        addLog(`Connected to ${portToUse} at 9600 baud.`);
      } else {
        setStatusMessage(data.error || "Connection failed. Please ensure HC-05 is paired.");
        addLog(`Connection failed: ${data.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connect failed";
      setStatusMessage(`Error: ${msg}`);
      addLog(`Error: ${msg}`);
    }
  };

  // Disconnect cleanly
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
    setActiveDevice(null);
    setStatusMessage("Bluetooth Disconnected.");
    addLog("Disconnected from Bluetooth device.");
  };

  // Send Command to Bluetooth HC-05
  // '1' -> LED 1 ON (Pin 2)
  // '0' -> LED 1 OFF (Pin 2)
  // '2' -> LED 2 ON (Pin 3)
  // '3' -> LED 2 OFF (Pin 3)
  const sendCommand = async (cmd: "1" | "0" | "2" | "3" | string) => {
    let actionLabel = `Command '${cmd}'`;
    if (cmd === "1") {
      setLed1State(true);
      actionLabel = "LED 1 ON ('1')";
    } else if (cmd === "0") {
      setLed1State(false);
      actionLabel = "LED 1 OFF ('0')";
    } else if (cmd === "2") {
      setLed2State(true);
      actionLabel = "LED 2 ON ('2')";
    } else if (cmd === "3") {
      setLed2State(false);
      actionLabel = "LED 2 OFF ('3')";
    }

    addLog(`Sent to HC-05 > '${cmd}' (${actionLabel})`);

    try {
      const res = await fetch("/api/led", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Confirmed: ${actionLabel}`);
      } else {
        addLog(`Send note: ${data.message || data.error}`);
      }
    } catch (err: unknown) {
      addLog(`Backend send error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Master All ON / All OFF
  const handleAllOn = async () => {
    await sendCommand("1");
    setTimeout(() => sendCommand("2"), 150);
  };

  const handleAllOff = async () => {
    await sendCommand("0");
    setTimeout(() => sendCommand("3"), 150);
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCmd.trim()) return;
    sendCommand(customCmd.trim());
    setCustomCmd("");
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      
      {/* Dual LED Remote Control Card */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/95 shadow-2xl p-6 relative overflow-hidden backdrop-blur">
        <div
          className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            led1State || led2State ? "bg-emerald-500/20" : "bg-blue-600/10"
          }`}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
                Battery Powered • Wireless HC-05
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Arduino Nano Dual LED Remote
            </h1>
          </div>

          <span
            className={`text-xs px-3 py-1 rounded-full font-medium border ${
              isConnected
                ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "bg-zinc-800/80 text-zinc-400 border-zinc-700"
            }`}
          >
            {isConnected ? `● Connected: ${activeDevice?.name || "HC-05"}` : "○ Disconnected"}
          </span>
        </div>

        {/* 4 LED BUTTONS CONTROLLER */}
        <div className="space-y-4">
          
          {/* LED 1 Panel (Pin 2) */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                    led1State
                      ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,1)]"
                      : "bg-zinc-700"
                  }`}
                />
                <div>
                  <h3 className="text-sm font-bold text-white">LED 1 (Pin 2)</h3>
                  <p className="text-[11px] text-zinc-400">
                    Status: <span className={led1State ? "text-emerald-400 font-semibold" : "text-zinc-500"}>{led1State ? "ON" : "OFF"}</span>
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                Cmd: 1 / 0
              </span>
            </div>

            {/* 2 Buttons for LED 1 */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => sendCommand("1")}
                className={`py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition-all transform active:scale-98 shadow cursor-pointer ${
                  led1State
                    ? "bg-emerald-500 text-white shadow-emerald-900/40 ring-2 ring-emerald-400/50"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                LED 1 ON (&apos;1&apos;)
              </button>

              <button
                onClick={() => sendCommand("0")}
                className={`py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition-all transform active:scale-98 shadow cursor-pointer ${
                  !led1State
                    ? "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
                    : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40"
                }`}
              >
                LED 1 OFF (&apos;0&apos;)
              </button>
            </div>
          </div>

          {/* LED 2 Panel (Pin 3) */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                    led2State
                      ? "bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,1)]"
                      : "bg-zinc-700"
                  }`}
                />
                <div>
                  <h3 className="text-sm font-bold text-white">LED 2 (Pin 3)</h3>
                  <p className="text-[11px] text-zinc-400">
                    Status: <span className={led2State ? "text-cyan-400 font-semibold" : "text-zinc-500"}>{led2State ? "ON" : "OFF"}</span>
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                Cmd: 2 / 3
              </span>
            </div>

            {/* 2 Buttons for LED 2 */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => sendCommand("2")}
                className={`py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition-all transform active:scale-98 shadow cursor-pointer ${
                  led2State
                    ? "bg-cyan-500 text-white shadow-cyan-900/40 ring-2 ring-cyan-400/50"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                LED 2 ON (&apos;2&apos;)
              </button>

              <button
                onClick={() => sendCommand("3")}
                className={`py-3 px-4 rounded-xl text-xs font-bold tracking-wide transition-all transform active:scale-98 shadow cursor-pointer ${
                  !led2State
                    ? "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
                    : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40"
                }`}
              >
                LED 2 OFF (&apos;3&apos;)
              </button>
            </div>
          </div>

          {/* Master All ON / All OFF Quick Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAllOn}
              className="flex-1 py-2 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700/60 transition cursor-pointer"
            >
              ⚡ ALL ON (1 + 2)
            </button>
            <button
              onClick={handleAllOff}
              className="flex-1 py-2 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700/60 transition cursor-pointer"
            >
              🌙 ALL OFF (0 + 3)
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-zinc-800/90 border border-zinc-700 text-xs text-zinc-200 flex items-center justify-between">
            <span className="leading-relaxed">{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-zinc-500 hover:text-white ml-2">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Available Bluetooth Devices List Section */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/85 shadow-xl p-6 space-y-4 backdrop-blur">
        
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m7 7 10 10-5 5V2l5 5L7 17" />
              </svg>
              Available Bluetooth Devices
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select your HC-05 to connect wirelessly with zero browser popups
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPairingWizard}
              disabled={isPairingLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow cursor-pointer"
            >
              Pair HC-05 (PIN: 1234)
            </button>
            <button
              onClick={scanBluetoothDevices}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition cursor-pointer disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-blue-400" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              {isScanning ? "Scanning..." : "Scan"}
            </button>
          </div>
        </div>

        {/* Device Cards Rendered Directly on UI */}
        <div className="space-y-2.5">
          {devices.length === 0 ? (
            <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-center">
              <p className="text-xs text-zinc-400">Scanning for Bluetooth devices...</p>
            </div>
          ) : (
            devices.map((device) => {
              const isThisConnected = isConnected && activeDevice?.id === device.id;

              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    isThisConnected
                      ? "border-emerald-500/60 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                      : device.isHC05
                      ? "border-blue-500/50 bg-blue-950/15 hover:border-blue-500"
                      : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isThisConnected
                          ? "bg-emerald-600/20 text-emerald-400"
                          : device.isHC05
                          ? "bg-blue-600/20 text-blue-400"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white tracking-tight">
                          {device.name}
                        </span>
                        {device.isHC05 && (
                          <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-full font-semibold">
                            HC-05 Wireless
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {device.status || "Ready to connect"} • 2.4 GHz SPP
                      </p>
                    </div>
                  </div>

                  <div>
                    {isThisConnected ? (
                      <button
                        onClick={handleDisconnect}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 text-xs font-semibold transition cursor-pointer"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectDevice(device)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow cursor-pointer ${
                          device.isHC05
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                        }`}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Serial Console Dropdown */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>{showTerminal ? "▼ Hide Live Console" : "▶ Show Live Terminal & Logs"}</span>
            </button>
            <span className="text-[10px] text-zinc-500 font-mono">Baud: 9600</span>
          </div>

          {showTerminal && (
            <div className="space-y-3 pt-1">
              <div className="h-32 overflow-y-auto rounded-xl bg-black/85 p-3 font-mono text-[11px] text-emerald-400 space-y-1 border border-zinc-800">
                {logs.length === 0 ? (
                  <div className="text-zinc-600">Terminal ready. Commands will appear here.</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="leading-tight">
                      {log}
                    </div>
                  ))
                )}
              </div>

              {/* Quick Send Input Bar */}
              <form onSubmit={handleCustomSend} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Send custom serial command (e.g. 1, 0, 2, 3)..."
                  value={customCmd}
                  onChange={(e) => setCustomCmd(e.target.value)}
                  className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!customCmd.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-xs text-zinc-500">
        Nano on Battery • Pin 2 (LED 1) & Pin 3 (LED 2) • Commands 1, 0, 2, 3
      </div>
    </div>
  );
}
