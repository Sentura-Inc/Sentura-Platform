import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const fixturePath = path.resolve(
    process.cwd(),
    "../..",
    "跨境电商/fixtures/accio-chat-records.sample.json",
  );

  try {
    const raw = await fs.readFile(fixturePath, "utf8");
    const chatExport = JSON.parse(raw);
    return NextResponse.json({
      source_label: "演示数据",
      source_path: "跨境电商/fixtures/accio-chat-records.sample.json",
      chat_export: chatExport,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Accio fixture.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

