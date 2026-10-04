import { NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST() {
  try {
    // Launch both the classic DevicePairingWizard and ms-settings:bluetooth in foreground
    exec('powershell -Command "Start-Process -FilePath DevicePairingWizard.exe -ErrorAction SilentlyContinue; Start-Process \'ms-settings:bluetooth\' -ErrorAction SilentlyContinue"');

    return NextResponse.json({
      success: true,
      message: "Opening Windows Bluetooth Pairing. Select HC-05 and enter PIN: 1234.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to launch pairing window";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
