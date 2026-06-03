#!/usr/bin/env tsx
/**
 * Sitlink / Zuolian Milestone 3 offline web-demo smoke test.
 *
 * Run: npx tsx scripts/test-zuolian-web-demo.ts
 *
 * This does not invoke a browser, LLM, or live OpenClaw gateway. It verifies
 * the deployable dashboard route shape for `/client-demos/zuolian`: scan-context
 * session seeding, hidden technical transcript seed, quick actions, side-panel
 * state updates, refresh recovery, and sidebar navigation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "sentura/dashboard/src/app/client-demos/zuolian/page.tsx");
const AGENT_CHAT = path.join(ROOT, "sentura/dashboard/src/components/agent-chat.tsx");
const SIDEBAR = path.join(ROOT, "sentura/dashboard/src/components/sidebar.tsx");

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

section("Route shape");
check("/client-demos/zuolian page exists", fs.existsSync(PAGE));
check("page is an interactive client component", page.startsWith('"use client";'));
check("page targets zuolian-travel-concierge", page.includes('AGENT_ID = "zuolian-travel-concierge"'));
check("page renders AgentChat instead of a fake transcript", page.includes("<AgentChat"));
check("sidebar links to Zuolian demo", sidebar.includes('href: "/client-demos/zuolian"') && sidebar.includes("Zuolian Demo"));

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
check("page waits before sending scan context", page.includes("请选择并确认机场") && page.includes("确认后才会把这组登机口扫码上下文发送给 Agent"));

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
check("hotel click sends simplified detail request", page.includes("我想查看${hotel.hotelNameZh}的详情"));
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
