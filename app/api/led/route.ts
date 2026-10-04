import { NextResponse } from "next/server";
import { serialManager } from "@/lib/serialManager";

export async function GET() {
  const status = serialManager.getStatus();
  return NextResponse.json({ success: true, status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let commandToSend = "";

    // 1. Direct command string: "1" | "0" | "2" | "3"
    if (typeof body.command === "string") {
      commandToSend = body.command;
    }
    // 2. LED specific toggle: { led: 1 | 2, state: boolean }
    else if (body.led === 1) {
      commandToSend = body.state ? "1" : "0";
    } else if (body.led === 2) {
      commandToSend = body.state ? "2" : "3";
    }
    // 3. Fallback single state: { state: boolean }
    else if (typeof body.state === "boolean") {
      commandToSend = body.state ? "1" : "0";
    } else {
      return NextResponse.json(
        { success: false, error: "Command ('1','0','2','3') or {led, state} is required" },
        { status: 400 }
      );
    }

    const success = await serialManager.sendCommand(commandToSend);
    const status = serialManager.getStatus();

    return NextResponse.json({
      success,
      status,
      commandSent: commandToSend,
      message: `Command '${commandToSend}' sent to HC-05/Nano`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
