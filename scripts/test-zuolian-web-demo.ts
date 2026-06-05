#!/usr/bin/env tsx
/**
 * Sitlink / Zuolian Milestone 3 offline web-demo smoke test.
 *
 * Run: npx tsx scripts/test-zuolian-web-demo.ts
 *
 * This does not invoke a browser, LLM, or live OpenClaw gateway. It verifies
 * the deployable dashboard route shape for `/client-demos/zuolian`: scan-context
 * session seeding, hidden technical transcript seed, WeCom-style iPhone chat UI,
 * quick actions, side-panel state updates, refresh recovery, and sidebar navigation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "sentura/dashboard/src/app/client-demos/zuolian/page.tsx");
const AGENT_CHAT = path.join(ROOT, "sentura/dashboard/src/components/agent-chat.tsx");
const SIDEBAR = path.join(ROOT, "sentura/dashboard/src/components/sidebar.tsx");
const HOTEL_DETAILS_ROUTE = path.join(
  ROOT,
  "sentura/dashboard/src/app/api/client-demos/zuolian/hotel-details/route.ts",
);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(label);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m━━━ ${title} ━━━\x1b[0m`);
}

const page = read(PAGE);
const agentChat = read(AGENT_CHAT);
const sidebar = read(SIDEBAR);
const hotelDetailsRoute = read(HOTEL_DETAILS_ROUTE);

section("Route shape");
check("/client-demos/zuolian page exists", fs.existsSync(PAGE));
check("page is an interactive client component", page.startsWith('"use client";'));
check("page targets zuolian-travel-concierge", page.includes('AGENT_ID = "zuolian-travel-concierge"'));
check("page renders AgentChat instead of a fake transcript", page.includes("<AgentChat"));
check("sidebar links to Zuolian demo", sidebar.includes('href: "/client-demos/zuolian"') && sidebar.includes("Zuolian Demo"));
check("hotel-detail API route exists", fs.existsSync(HOTEL_DETAILS_ROUTE));
check("hotel-detail API route reuses Dida MCP fixture client", hotelDetailsRoute.includes("DidaTravelDemoClient") && hotelDetailsRoute.includes("loadConfigFromEnv"));
check("hotel-detail API route calls MCP getHotelDetails", hotelDetailsRoute.includes("getHotelDetails") && hotelDetailsRoute.includes("hotelIds: [body.hotelId.trim()]"));

section("iPhone 企业微信 chat UI");
check("right chat window uses centered screenshot-style iPhone shell", page.includes("IphoneWeComShell") && page.includes("h-[604px]") && page.includes("w-[280px]"));
check("iPhone shell keeps blue simulated status bar", page.includes("15:38") && page.includes("5G") && page.includes("bg-[#3977cc]"));
check("iPhone shell renders screenshot conversation header", page.includes("23(创建人)") && page.includes("Video") && page.includes("MoreHorizontal"));
check("quick actions remain wired but hidden from screenshot header", page.includes('className="hidden"') && page.includes("客服在线") && page.includes("等待接入"));
check("phone starts with blank conversation before airport confirmation", page.includes("WeComBlankConversation") && page.includes("企业微信空白聊天页"));
check("phone shell does not render fake startup messages", !page.includes("DemoPhoneAttachmentStack") && !page.includes("bg-[#4b8fea]"));
check("Zuolian page asks AgentChat for WeCom phone presentation", page.includes('presentation="wecom-phone"'));
check("AgentChat exposes optional presentation prop", agentChat.includes('presentation?: "default" | "wecom-phone"'));
check("WeCom presentation uses light grey chat canvas", agentChat.includes('presentation === "wecom-phone" && "bg-[#e9ebf1]"'));
check("WeCom bubbles use Enterprise WeChat-like colors", agentChat.includes("bg-[#95ec69]") && agentChat.includes("bg-[#07c160]"));
check("WeCom composer uses screenshot-style voice/input/smile/plus controls", agentChat.includes('"输入消息"') && agentChat.includes('aria-label="语音"') && agentChat.includes('aria-label="表情"') && agentChat.includes("<Plus"));
check("WeCom avatars use compact chat labels", agentChat.includes('"我"') && agentChat.includes('"坐"'));
check("AgentChat supports clickable hotel names in assistant bubbles", agentChat.includes("interactiveTerms") && agentChat.includes("renderInteractiveText"));
check("Zuolian page has fallback hotel terms for assistant replies", page.includes("demoHotelCatalog") && page.includes("深圳东海朗廷酒店"));

section("Scan-context proactive greeting");
check("scan context records boarding-gate QR event", page.includes('event: "boarding_gate_qr_scanned"'));
check("scan context records gate entry placement", page.includes('entryPlacement: "登机口扫码入口"'));
check("scan context records origin airport code", page.includes("originAirportCode"));
check("scan context records destination airport code", page.includes("destinationAirportCode"));
check("seed message has hidden prefix", page.includes('HIDDEN_SEED_PREFIX = "[座联互动 Demo 扫码上下文]"'));
check("session is created before scan seed is sent", page.includes("client.createSession(AGENT_ID, undefined"));
check("scan seed is sent through hidden AgentChat message", page.includes("pendingSeed") && page.includes("chatRef.current?.sendMessage(seed.message)"));
check("empty restored sessions are re-seeded", page.includes("client.getTranscript(stored, 1)") && page.includes("transcript.length === 0"));
check("seed instructs agent to generate the greeting", page.includes("主动向用户发出第一条简体中文客服问候"));
check("technical seed is hidden from visible transcript", page.includes("hiddenUserPrefixes={[HIDDEN_SEED_PREFIX]}"));

section("Airport selectors");
for (const airport of [
  "广州白云国际机场",
  "北京首都国际机场",
  "上海浦东国际机场",
  "杭州萧山国际机场",
  "香港国际机场",
  "澳门国际机场",
  "深圳宝安国际机场",
]) {
  check(`airport option exists: ${airport}`, page.includes(airport));
}
check("page renders origin airport selector", page.includes("当前位置机场") && page.includes("updateOriginAirport"));
check("page renders destination airport selector", page.includes("目的地机场") && page.includes("updateDestinationAirport"));
check("same airport cannot be selected as destination", page.includes("disabledCode={draftOriginAirport.code}"));
check("airport confirmation button exists", page.includes("确认机场并通知客服") && page.includes("confirmAirports"));
check("route confirmation gates the session", page.includes("confirmedRoute") && page.includes("routeHasPendingChanges"));
check("page waits before sending scan context", page.includes("WeComBlankConversation") && page.includes("confirmedRoute"));

section("Refresh recovery");
check("session key persists in localStorage", page.includes("SESSION_STORAGE_KEY_PREFIX") && page.includes("window.localStorage.setItem"));
check("stored session is validated on load", page.includes("await client.getSession(stored)"));
check("stale stored session is cleared", page.includes("window.localStorage.removeItem(sessionStorageKey)"));
check("reset button creates a fresh demo session", page.includes("resetDemo") && page.includes("重开 Demo"));

section("Demo controls and state");
for (const label of [
  "制定 5 日",
  "预算低一点",
  "住宿更方便",
  "确认并预订",
  "查询订单",
  "取消订单",
  "修改订单",
]) {
  check(`quick action exists: ${label}`, page.includes(label));
}
check("quick action documents Dida cancel flow", page.includes("pre-cancel 获取 ConfirmID") && page.includes("cancelconfirm 确认取消"));
check("quick action documents background modify flow", page.includes("PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm"));
check("quick actions send directly through AgentChat handle", page.includes("chatRef.current.sendMessage(message)"));
check("side panel shows scan context", page.includes("登机口扫码模拟") && page.includes("登机口扫码入口"));
check("side panel shows itinerary/tool status", page.includes("行程与工具状态") && page.includes("最近工具"));
check("side panel shows order status", page.includes("订单状态") && page.includes("BookingID") && page.includes("ReferenceNo"));
check("side panel shows clickable hotel candidates", page.includes("酒店候选") && page.includes("handleHotelClick"));
check("hotel candidate click opens local detail dialog", page.includes("HotelDetailDialog") && page.includes("setHotelDialogOpen(true)"));
check("hotel candidate click fetches MCP detail payload", page.includes('fetch("/api/client-demos/zuolian/hotel-details"') && page.includes("loadHotelDetail"));
check("hotel dialog shows MCP loading and error states", page.includes("hotelDetailLoading") && page.includes("正在读取 Dida MCP 酒店详情") && page.includes("hotelDetailError"));
check("hotel detail dialog is constrained inside the iPhone shell", page.includes('data-testid="phone-hotel-detail-overlay"') && page.includes("absolute inset-0 z-30") && !page.includes('@/components/ui/dialog'));
check("hotel candidate click no longer sends a detail chat message", !page.includes("我想查看${hotel.hotelNameZh}的详情"));
check("hotel dialog renders blank image placeholders", page.includes("当前 Demo 不加载真实图片") && page.includes("data.images.caption/url/isDefault"));
check("hotel dialog can open from chat hotel-name clicks", page.includes("onInteractiveTermClick={openHotelFromChat}") && page.includes("hotelInteractiveTerms"));
check("chat hotel-name clicks fall back to local hotel catalog", page.includes("demoHotelCatalog.find((candidate) => candidate.hotelId === hotelId)"));
check("hotel parser extracts MCP room and policy fields", page.includes("firstRoom") && page.includes("boardNameZh") && page.includes("cancellationPolicyZh"));
check("hotel dialog renders MCP content sections", page.includes("酒店介绍") && page.includes("地址") && page.includes("房型与政策") && page.includes("入住说明") && page.includes("MCP 来源"));
check("hotel dialog does not use one-size-fits-all hotel templates", !page.includes("是当前 Dida Demo 酒店候选之一") && !page.includes('["免费 Wi-Fi", "健身房", "餐厅", "行李寄存", "24 小时前台"]'));
check("hotel click does not expose tool call details", !page.includes("hotelIds 只传") && !page.includes("请调用 Dida Content API 模拟详情工具"));

section("Tool flow contract");
for (const tool of [
  "dida_demo_search_hotels",
  "dida_demo_get_hotel_details",
  "dida_demo_search_transfer",
  "dida_demo_search_attractions",
  "web_search",
  "web_fetch",
  "dida_demo_price_confirm",
  "dida_demo_book_hotel",
  "dida_demo_get_booking",
  "dida_demo_pre_cancel_booking",
  "dida_demo_cancel_booking",
  "dida_demo_modify_booking",
]) {
  check(`flow maps tool: ${tool}`, page.includes(tool));
}
check("order parser extracts bookingId", page.includes('"bookingId"') && page.includes("bookingId"));
check("order parser extracts referenceNo", page.includes('"referenceNo"') && page.includes("referenceNo"));
check("order parser prefers modified newBooking", page.includes("parsed?.newBooking") && page.includes("preferred"));
check("order parser extracts Dida status", page.includes('"status"') && page.includes("Number(statusText)"));
check("status copy guards status 2 Confirmed", page.includes("只有 Dida 状态码 2 Confirmed"));
check("hotel parser extracts search candidates", page.includes("extractHotelCandidates") && page.includes("pricePerRoomCny"));
check("hotel parser extracts Content API details", page.includes("extractHotelDetail") && page.includes("facilitiesZh") && page.includes("nearbyZh"));

section("AgentChat support");
check("AgentChat exposes hiddenUserPrefixes prop", agentChat.includes("hiddenUserPrefixes?: string[]"));
check("AgentChat filters hidden user messages", agentChat.includes("isHiddenUserMessage"));
check("AgentChat handle exposes sendMessage", agentChat.includes("sendMessage: (text: string) => Promise<void>"));
check("AgentChat imperative send uses sendText", agentChat.includes("sendMessage: (text) => sendText(text)"));

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`Failures: ${failures.join(", ")}`);
  process.exit(1);
}
