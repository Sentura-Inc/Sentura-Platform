import fs from "node:fs/promises";
import path from "node:path";
import JSON5 from "../../openclaw/node_modules/json5/lib/index.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJson5(raw: string): unknown {
  return JSON5.parse(raw);
}

export function stringifyJson5(value: unknown): string {
  return `${JSON5.stringify(value, { space: 2, quote: '"' })}\n`;
}

export async function readJson5File(filePath: string): Promise<{ raw: string; parsed: unknown }> {
  const raw = await fs.readFile(filePath, "utf8");
  return {
    raw,
    parsed: parseJson5(raw),
  };
}

export async function readJson5Object(
  filePath: string,
): Promise<{ raw: string; parsed: Record<string, unknown> }> {
  const { raw, parsed } = await readJson5File(filePath);
  if (!isRecord(parsed)) {
    throw new Error(`${filePath} must parse to a JSON5 object.`);
  }
  return { raw, parsed };
}

export async function readJson5ObjectIfExists(
  filePath: string,
): Promise<{ raw: string | null; parsed: Record<string, unknown>; existed: boolean }> {
  try {
    const { raw, parsed } = await readJson5Object(filePath);
    return { raw, parsed, existed: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { raw: null, parsed: {}, existed: false };
    }
    throw err;
  }
}

export async function writeJson5Object(
  filePath: string,
  value: Record<string, unknown>,
): Promise<string> {
  const serialized = stringifyJson5(value);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serialized, "utf8");
  return serialized;
}
