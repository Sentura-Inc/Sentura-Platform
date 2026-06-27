import type { GatewayChatAttachment } from "@/lib/gateway";

export type MemoryImportInputFormat = "json" | "pasted_text" | "image";
export type MemoryImportSourceKind = "manual_json" | "manual_text" | "manual_image";

export interface MemoryImageAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  dataBase64: string;
}

export interface PreparedMemoryImport {
  recordName: string;
  chatExport: Record<string, unknown>;
  inputFormat: MemoryImportInputFormat;
  sourceKind: MemoryImportSourceKind;
  rawText?: string;
  attachments?: MemoryImageAttachment[];
  attachmentMetadata?: Array<Record<string, unknown>>;
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isoNow() {
  return new Date().toISOString();
}

function baseRecordName(name: string) {
  return name.replace(/\.(json|txt|png|jpe?g|webp|heic|heif)$/i, "").trim();
}

function fallbackRecordName(prefix: string) {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${prefix} ${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function unknownBuyer(index = 1, buyerType?: string) {
  return {
    display_name: "待确认联系人",
    company_name: index > 1 ? `待确认客户 ${index}` : "待确认客户",
    country: "ZZ",
    ...(buyerType ? { buyer_type: buyerType, self_described_identity: buyerType } : {}),
  };
}

function normalizeExportMetadata(
  payload: Record<string, unknown>,
  sourceFile: string,
  platform: string,
  inputFormat: MemoryImportInputFormat,
) {
  const metadata = asRecord(payload.export_metadata);
  return {
    platform: asString(metadata.platform) ?? platform,
    exported_at: asString(metadata.exported_at) ?? isoNow(),
    seller_company: asString(metadata.seller_company) ?? "Sentura cross-border demo",
    source_file: asString(metadata.source_file) ?? sourceFile,
    data_classification: asString(metadata.data_classification) ?? "T3 business chat record",
    input_format: inputFormat,
  };
}

export function normalizeJsonMemoryImport(payload: unknown, fileName: string): PreparedMemoryImport {
  const record = asRecord(payload);
  const conversations = Array.isArray(record.conversations) ? record.conversations : [];
  if (conversations.length === 0) {
    throw new Error("JSON 中没有 conversations[]，无法作为聊天记录导入。");
  }
  return {
    recordName: baseRecordName(fileName) || fallbackRecordName("聊天记录 JSON"),
    chatExport: {
      ...record,
      export_metadata: normalizeExportMetadata(record, fileName, "Manual Accio JSON import", "json"),
      conversations,
    },
    inputFormat: "json",
    sourceKind: "manual_json",
  };
}

function timestampFromLine(line: string): string | undefined {
  const normalized = line.replace(/\//g, "-").trim();
  const dateTime = normalized.match(/^(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2}:\d{2})(?::\d{2})?$/);
  if (dateTime) {
    const [yyyy, mm, dd] = dateTime[1].split("-").map((part) => part.padStart(2, "0"));
    return new Date(`${yyyy}-${mm}-${dd}T${dateTime[2]}:00+08:00`).toISOString();
  }
  return undefined;
}

function senderFromText(text: string): "buyer" | "seller" | "system" {
  if (/我是.+?(老板|店主|采购|负责人|买手|商家|卖家|owner|buyer|purchaser)/i.test(text)) {
    return "buyer";
  }
  if (/[？?]|多久|现货|可以发货|价格|报价|采购|需要|有没有|能否|是否|MOQ|quote|need|can you|how soon/i.test(text)) {
    return "buyer";
  }
  if (/in stock|ships?|available|we can|our price|best price|hello|dear|yes[,， ]/i.test(text)) {
    return "seller";
  }
  return "system";
}

function selfDescribedBuyerType(rawText: string) {
  const normalized = rawText.replace(/\s+/g, " ");
  const zhMatch = normalized.match(/我是([^。！？!?，,；;\n]{1,24}?(?:老板|店主|采购|负责人|买手|商家|卖家))/);
  if (zhMatch?.[1]) return zhMatch[1].trim();
  const enMatch = normalized.match(/\b(?:i am|i'm|im)\s+(?:a|an|the)?\s*([^.,!?;\n]{1,32}?(?:owner|buyer|purchaser|merchant|seller|shopkeeper))\b/i);
  if (enMatch?.[1]) return enMatch[1].trim();
  return undefined;
}

function parseTextMessages(rawText: string) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const messages: Array<{ timestamp: string; sender: "buyer" | "seller" | "system"; text: string }> = [];
  let lastTimestamp = isoNow();
  for (const line of lines) {
    const timestamp = timestampFromLine(line);
    if (timestamp) {
      lastTimestamp = timestamp;
      if (messages.length > 0) {
        messages[messages.length - 1].timestamp = timestamp;
      }
      continue;
    }
    const senderWithTime = line.match(/^(.+?)\s+(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2})(?::\d{2})?\s*$/);
    if (senderWithTime) {
      lastTimestamp = timestampFromLine(senderWithTime[2]) ?? lastTimestamp;
      continue;
    }
    messages.push({
      timestamp: lastTimestamp,
      sender: senderFromText(line),
      text: line,
    });
  }
  if (messages.length === 0) {
    throw new Error("粘贴内容里没有可读取的聊天文字。");
  }
  return messages;
}

export function normalizeTextMemoryImport(rawText: string): PreparedMemoryImport {
  const text = rawText.trim();
  const messages = parseTextMessages(text);
  const recordName = fallbackRecordName("手动聊天记录");
  const buyerType = selfDescribedBuyerType(text);
  return {
    recordName,
    rawText: text,
    inputFormat: "pasted_text",
    sourceKind: "manual_text",
    chatExport: {
      export_metadata: normalizeExportMetadata({}, `${recordName}.txt`, "Manual pasted chat import", "pasted_text"),
      conversations: [
        {
          conversation_id: `manual_text_${Date.now()}`,
          buyer: unknownBuyer(1, buyerType),
          messages,
          attachments: [],
          import_notes: {
            parser: "line_based_manual_text",
            incomplete_possible: true,
            missing_fields: ["company_name", "country", "contact_person"],
            ...(buyerType ? { self_described_identity: buyerType } : {}),
          },
        },
      ],
    },
  };
}

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function imageMimeType(file: File) {
  const explicit = file.type.toLowerCase();
  if (explicit) return explicit;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  return "application/octet-stream";
}

export async function normalizeImageMemoryImport(files: FileList | File[]): Promise<PreparedMemoryImport> {
  const imageFiles = Array.from(files).filter((file) => file.size > 0);
  if (imageFiles.length === 0) {
    throw new Error("请至少选择一张聊天截图。");
  }
  const attachments: MemoryImageAttachment[] = [];
  for (const file of imageFiles) {
    const mimeType = imageMimeType(file);
    if (!ACCEPTED_IMAGE_TYPES.has(mimeType)) {
      throw new Error(`不支持的截图格式：${file.name || mimeType}`);
    }
    if (file.size > IMAGE_MAX_BYTES) {
      throw new Error(`${file.name} 超过 10MB。请压缩截图，或改用粘贴文字导入。`);
    }
    const buffer = await file.arrayBuffer();
    attachments.push({
      fileName: file.name || `chat-screenshot-${attachments.length + 1}`,
      mimeType,
      sizeBytes: file.size,
      sha256: await sha256Hex(buffer),
      dataBase64: arrayBufferToBase64(buffer),
    });
  }
  const recordName =
    attachments.length === 1
      ? baseRecordName(attachments[0].fileName) || fallbackRecordName("聊天截图")
      : fallbackRecordName(`聊天截图 ${attachments.length} 张`);
  const attachmentMetadata = attachments.map((attachment, index) => ({
    file_name: attachment.fileName,
    type: attachment.mimeType,
    size_bytes: attachment.sizeBytes,
    sha256: attachment.sha256,
    image_index: index + 1,
    description: "Manual chat screenshot queued for vision transcription; raw image is sent to the model for this task only.",
  }));
  return {
    recordName,
    inputFormat: "image",
    sourceKind: "manual_image",
    attachments,
    attachmentMetadata,
    chatExport: {
      export_metadata: normalizeExportMetadata({}, `${recordName}.images`, "Manual chat screenshot import", "image"),
      conversations: [
        {
          conversation_id: `manual_image_${Date.now()}`,
          buyer: unknownBuyer(),
          messages: [
            {
              timestamp: isoNow(),
              sender: "system",
              text: `Imported ${attachments.length} chat screenshot(s). Vision transcription is required before summary.`,
            },
          ],
          attachments: attachmentMetadata.map((item) => ({
            file_name: item.file_name,
            type: item.type,
            description: item.description,
          })),
          import_notes: {
            parser: "vision_required",
            missing_fields: ["company_name", "country", "contact_person"],
            raw_image_retention: "not_persisted",
          },
        },
      ],
    },
  };
}

export function toGatewayChatAttachments(attachments: MemoryImageAttachment[] | undefined): GatewayChatAttachment[] {
  return (attachments ?? []).map((attachment) => ({
    type: "image",
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    source: {
      type: "base64",
      media_type: attachment.mimeType,
      data: attachment.dataBase64,
    },
  }));
}
