import { NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST() {
  try {
    // Launch Windows DevicePairingWizard to scan and pair HC-05 with PIN 1234
    exec("DevicePairingWizard.exe", (error) => {
      if (error) {
        // Fallback to Windows 10/11 Bluetooth settings page if wizard fails
        exec("start ms-settings:bluetooth");
      }
    });

    return NextResponse.json({
      success: true,
      message: "Opened Windows Bluetooth Pairing Wizard. Select 'HC-05' and enter PIN 1234.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to open pairing wizard";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
