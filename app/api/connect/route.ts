import { NextResponse } from "next/server";
import { serialManager } from "@/lib/serialManager";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, port, baudRate } = body;

    if (action === "disconnect") {
      await serialManager.disconnect();
      return NextResponse.json({
        success: true,
        message: "Disconnected",
        status: serialManager.getStatus(),
      });
    }

    if (action === "connect") {
      if (!port) {
        return NextResponse.json(
          { success: false, error: "Port path is required" },
          { status: 400 }
        );
      }

      const connected = await serialManager.connect(port, Number(baudRate) || 9600);
      const status = serialManager.getStatus();

      if (!connected) {
        return NextResponse.json(
          {
            success: false,
            error: status.lastError || "Could not connect to port",
            status,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Connected to ${port}`,
        status,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
