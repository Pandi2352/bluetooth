import { NextResponse } from "next/server";
import { serialManager } from "@/lib/serialManager";

export async function GET() {
  try {
    const devices = await serialManager.listDevices();
    const status = serialManager.getStatus();
    return NextResponse.json({
      success: true,
      devices,
      status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
