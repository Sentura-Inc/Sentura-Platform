import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import {
  DidaTravelDemoClient,
  createServer,
  listTools,
  loadConfigFromEnv,
} from "./index.js";

async function connect() {
  const { server } = await createServer({ config: { mode: "fixture" } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client(
    { name: "zuolian-travel-agent-test", version: "0.0.0-test" },
    { capabilities: {} },
  );
  await client.connect(clientTransport);
  return { client, server };
}

function parseToolResult(result: Awaited<ReturnType<Client["callTool"]>>) {
  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  return JSON.parse(text) as Record<string, unknown>;
}

const contact = {
  firstName: "Henry",
  lastName: "Li",
  phone: "+8613800000000",
  email: "henry@example.com",
};

const guestList = [
  {
    roomIndex: 1,
    guests: [{ firstName: "Henry", lastName: "Li", phone: "+8613800000000" }],
  },
];

describe("DidaTravel demo config", () => {
  it("defaults to fixture mode and official Dida test domains", () => {
    const cfg = loadConfigFromEnv({});
    expect(cfg.mode).toBe("fixture");
    expect(cfg.bookingBaseUrl).toBe("https://apiint.didatravel.com");
    expect(cfg.contentBaseUrl).toBe("https://static-apiint.didatravel.com");
  });

  it("supports explicit proxy-disabled mode without enabling live calls", () => {
    const cfg = loadConfigFromEnv({ DIDA_DEMO_MODE: "proxy-disabled" });
    expect(cfg.mode).toBe("proxy-disabled");
  });
});

describe("DidaTravel demo tool catalog", () => {
  it("registers the Phase 1 tool surface with Dida source metadata", () => {
    expect(listTools().map((tool) => tool.name)).toEqual([
      "dida_demo_search_hotels",
      "dida_demo_price_confirm",
      "dida_demo_book_hotel",
      "dida_demo_get_booking",
      "dida_demo_search_transfer",
      "dida_demo_search_attractions",
    ]);
    expect(listTools()[0].endpoint).toBe("POST /api/rate/pricesearch?$format=json");
    expect(listTools()[1].endpoint).toBe("POST /api/rate/PriceConfirm?$format=json");
    expect(listTools()[2].endpoint).toBe("POST /api/booking/HotelBookingConfirm?$format=json");
    expect(listTools()[3].endpoint).toBe("POST /api/booking/HotelBookingSearch?$format=json");
  });

  it("marks booking as approval-worthy and discovery tools as read-only", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const searchHotels = tools.find((tool) => tool.name === "dida_demo_search_hotels");
    const bookHotel = tools.find((tool) => tool.name === "dida_demo_book_hotel");
    expect(searchHotels?.annotations?.readOnlyHint).toBe(true);
    expect(searchHotels?.annotations?.destructiveHint).toBe(false);
    expect(bookHotel?.annotations?.readOnlyHint).toBe(false);
    expect(bookHotel?.annotations?.destructiveHint).toBe(true);
    expect(bookHotel?._meta?.["sentura/sourceDoc"]).toContain("booking-confirm");
  });
});

describe("DidaTravel demo MCP flow", () => {
  it("runs PriceSearch -> PriceConfirm(preBook=true) -> BookingConfirm -> BookingSearch", async () => {
    const { client } = await connect();

    const search = parseToolResult(
      await client.callTool({
        name: "dida_demo_search_hotels",
        arguments: {
          city: "Shenzhen",
          checkInDate: "2026-06-11",
          checkOutDate: "2026-06-15",
          roomCount: 1,
          adultCount: 2,
          childCount: 0,
        },
      }),
    );
    const firstHotel = (search.hotels as Array<Record<string, unknown>>)[0];
    expect(search.locale).toBe("zh-CN");
    expect(firstHotel.locale).toBe("zh-CN");
    expect(firstHotel.hotelNameZh).toBe("深圳湾海景臻选酒店");
    expect(firstHotel.roomNameZh).toBe("豪华湾景大床房");
    expect(firstHotel.cancellationPolicyZh).toContain("免费取消");
    expect(firstHotel.displaySummaryZh).toContain("深圳湾海景臻选酒店");
    expect(firstHotel.metadata).toBe("DIDA_META_SZX_BAY_20260611_20260615_RP_BB");
    expect(search.requestModel).toMatchObject({
      CheckInDate: "2026-06-11",
      CheckOutDate: "2026-06-15",
      Currency: "CNY",
      Nationality: "CN",
    });

    const confirmed = parseToolResult(
      await client.callTool({
        name: "dida_demo_price_confirm",
        arguments: {
          hotelId: firstHotel.hotelId,
          ratePlanId: firstHotel.ratePlanId,
          checkInDate: "2026-06-11",
          checkOutDate: "2026-06-15",
          roomCount: 1,
          adultCount: 2,
          childCount: 0,
          metadata: firstHotel.metadata,
          preBook: true,
        },
      }),
    );
    expect(confirmed.referenceNo).toMatch(/^DIDA-PRE-ZL-/);
    expect(confirmed.finalTotalCny).toBe(3920);
    expect(confirmed.locale).toBe("zh-CN");
    expect(confirmed.hotelNameZh).toBe("深圳湾海景臻选酒店");
    expect(confirmed.finalCancellationPolicyZh).toContain("免费取消");
    expect(confirmed.displaySummaryZh).toContain("总价 CNY 3920");

    const booked = parseToolResult(
      await client.callTool({
        name: "dida_demo_book_hotel",
        arguments: {
          referenceNo: confirmed.referenceNo,
          contact,
          guestList,
          clientReference: "ZUOLIAN-DEMO-001",
        },
      }),
    );
    expect(booked).toMatchObject({
      bookingId: "DIDA-BOOK-ZL-000001",
      status: 2,
      statusName: "Confirmed",
      final: true,
      clientReference: "ZUOLIAN-DEMO-001",
    });
    expect(booked.locale).toBe("zh-CN");
    expect(booked.statusNameZh).toBe("已确认");
    expect(booked.hotelNameZh).toBe("深圳湾海景臻选酒店");
    expect(booked.confirmationMessageZh).toContain("酒店预订已确认");

    const order = parseToolResult(
      await client.callTool({
        name: "dida_demo_get_booking",
        arguments: { bookingId: booked.bookingId },
      }),
    );
    expect(order).toMatchObject({
      bookingId: booked.bookingId,
      referenceNo: confirmed.referenceNo,
      status: 2,
      final: true,
    });
    expect(order.locale).toBe("zh-CN");
    expect(order.statusNameZh).toBe("已确认");
    expect(order.displaySummaryZh).toContain("Dida 状态 2 Confirmed");
  });

  it("does not allow BookingConfirm after PriceConfirm(preBook=false)", async () => {
    const demo = new DidaTravelDemoClient(loadConfigFromEnv({}));
    const confirmed = demo.priceConfirm({
      hotelId: "DIDA-SZX-10001",
      ratePlanId: "RP-SZX-BAY-BB",
      checkInDate: "2026-06-11",
      checkOutDate: "2026-06-15",
      childCount: 0,
      metadata: "DIDA_META_SZX_BAY_20260611_20260615_RP_BB",
      preBook: false,
    });
    expect(confirmed.referenceNo).toBeUndefined();
    expect(() =>
      demo.bookHotel({
        referenceNo: "DIDA-PRE-ZL-MISSING",
        contact,
        guestList,
      }),
    ).toThrow(/PreBook=true/);
  });

  it("rejects metadata changed between PriceSearch and PriceConfirm", () => {
    const demo = new DidaTravelDemoClient(loadConfigFromEnv({}));
    expect(() =>
      demo.priceConfirm({
        hotelId: "DIDA-SZX-10001",
        ratePlanId: "RP-SZX-BAY-BB",
        checkInDate: "2026-06-11",
        checkOutDate: "2026-06-15",
        childCount: 0,
        metadata: "tampered",
        preBook: true,
      }),
    ).toThrow(/Metadata/);
  });

  it("rejects duplicate BookingConfirm calls for one ReferenceNo", () => {
    const demo = new DidaTravelDemoClient(loadConfigFromEnv({}));
    const confirmed = demo.priceConfirm({
      hotelId: "DIDA-SZX-10001",
      ratePlanId: "RP-SZX-BAY-BB",
      checkInDate: "2026-06-11",
      checkOutDate: "2026-06-15",
      childCount: 0,
      metadata: "DIDA_META_SZX_BAY_20260611_20260615_RP_BB",
      preBook: true,
    });
    demo.bookHotel({ referenceNo: confirmed.referenceNo, contact, guestList });
    expect(() => demo.bookHotel({ referenceNo: confirmed.referenceNo, contact, guestList })).toThrow(
      /already been consumed/,
    );
  });

  it("treats Dida status 0/1/5/6 as non-final and 2/3/4 as final", () => {
    const demo = new DidaTravelDemoClient(loadConfigFromEnv({}));
    for (const status of [0, 1, 5, 6] as const) {
      const confirmed = demo.priceConfirm({
        hotelId: "DIDA-SZX-10002",
        ratePlanId: "RP-SZX-FTN-RO",
        checkInDate: "2026-06-11",
        checkOutDate: "2026-06-15",
        childCount: 0,
        metadata: "DIDA_META_SZX_FTN_20260611_20260615_RP_RO",
        preBook: true,
      });
      const booking = demo.bookHotel({
        referenceNo: confirmed.referenceNo,
        contact,
        guestList,
        simulateStatus: status,
      }) as Record<string, unknown>;
      expect(booking.final).toBe(false);
    }

    for (const status of [2, 3, 4] as const) {
      const confirmed = demo.priceConfirm({
        hotelId: "DIDA-SZX-10003",
        ratePlanId: "RP-SZX-OCT-FAM",
        checkInDate: "2026-06-11",
        checkOutDate: "2026-06-15",
        childCount: 0,
        metadata: "DIDA_META_SZX_OCT_20260611_20260615_RP_FAM",
        preBook: true,
      });
      const booking = demo.bookHotel({
        referenceNo: confirmed.referenceNo,
        contact,
        guestList,
        simulateStatus: status,
      }) as Record<string, unknown>;
      expect(booking.final).toBe(true);
    }
  });

  it("returns local transfer and attraction fixtures for itinerary planning", () => {
    const demo = new DidaTravelDemoClient(loadConfigFromEnv({}));
    const transfer = demo.searchTransfers({
      pickup: "Shenzhen Bao'an Airport",
      dropoff: "Nanshan hotel",
      pickupDateTime: "2026-06-11T14:30",
      passengers: 2,
    }) as Record<string, unknown>;
    const attractions = demo.searchAttractions({
      city: "Shenzhen",
      startDate: "2026-06-11",
      endDate: "2026-06-15",
      travelers: 2,
    }) as Record<string, unknown>;
    expect(transfer.source).toBe("demo-fixture");
    expect(attractions.source).toBe("demo-fixture");
    expect(transfer.options).toHaveLength(2);
    expect(attractions.options).toHaveLength(3);
  });

  it("returns zh-CN display fields without changing Dida machine fields", () => {
    const demo = new DidaTravelDemoClient(loadConfigFromEnv({}));
    const search = demo.searchHotels({
      city: "深圳",
      checkInDate: "2026-06-11",
      checkOutDate: "2026-06-15",
      childCount: 0,
    }) as Record<string, unknown>;
    const hotel = (search.hotels as Array<Record<string, unknown>>)[0];
    expect(search.locale).toBe("zh-CN");
    expect(hotel).toMatchObject({
      hotelId: "DIDA-SZX-10001",
      ratePlanId: "RP-SZX-BAY-BB",
      metadata: "DIDA_META_SZX_BAY_20260611_20260615_RP_BB",
      locale: "zh-CN",
      hotelNameZh: "深圳湾海景臻选酒店",
      roomNameZh: "豪华湾景大床房",
      boardNameZh: "含早餐",
    });
    expect(hotel.displaySummaryZh).toContain("CNY 980");

    const transfer = demo.searchTransfers({
      pickup: "深圳宝安国际机场",
      dropoff: "南山酒店",
      pickupDateTime: "2026-06-11T14:30",
      passengers: 2,
    }) as Record<string, unknown>;
    const transferOption = (transfer.options as Array<Record<string, unknown>>)[0];
    expect(transfer.locale).toBe("zh-CN");
    expect(transferOption).toMatchObject({
      transferId: "SZX-TRANSFER-AIRPORT-NANSHAN-7",
      locale: "zh-CN",
      transferNameZh: "深圳宝安机场至南山酒店专车",
      vehicleClassZh: "商务 7 座车",
    });
    expect(transferOption.displaySummaryZh).toContain("举牌接机");

    const attractions = demo.searchAttractions({
      city: "深圳",
      startDate: "2026-06-11",
      endDate: "2026-06-15",
      travelers: 2,
    }) as Record<string, unknown>;
    const attraction = (attractions.options as Array<Record<string, unknown>>)[0];
    expect(attractions.locale).toBe("zh-CN");
    expect(attraction).toMatchObject({
      attractionId: "SZX-TICKET-WINDOW-WORLD",
      locale: "zh-CN",
      attractionNameZh: "世界之窗",
      ticketTypeZh: "成人日场票",
      estimatedTotalCny: 440,
    });
    expect(attraction.displaySummaryZh).toContain("世界之窗");
  });
});
