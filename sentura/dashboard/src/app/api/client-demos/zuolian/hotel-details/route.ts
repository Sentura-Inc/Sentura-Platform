import { NextResponse } from "next/server";
import {
  DidaTravelDemoClient,
  loadConfigFromEnv,
} from "../../../../../../../mcp-servers/dida-travel-demo/src/index";

const didaDemoClient = new DidaTravelDemoClient(loadConfigFromEnv());

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { hotelId?: unknown };
    if (typeof body.hotelId !== "string" || body.hotelId.trim().length === 0) {
      return NextResponse.json(
        { error: "hotelId is required" },
        { status: 400 },
      );
    }

    const result = didaDemoClient.getHotelDetails({
      hotelIds: [body.hotelId.trim()],
      language: "zh-CN",
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load hotel details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
