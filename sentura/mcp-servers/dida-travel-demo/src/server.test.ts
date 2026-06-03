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
      "dida_demo_get_hotel_details",
      "dida_demo_book_hotel",
      "dida_demo_get_booking",
      "dida_demo_pre_cancel_booking",
      "dida_demo_cancel_booking",
      "dida_demo_modify_booking",
      "dida_demo_search_transfer",
      "dida_demo_search_attractions",
    ]);
    expect(listTools()[0].endpoint).toBe("POST /api/rate/pricesearch?$format=json");
    expect(listTools()[1].endpoint).toBe("POST /api/rate/PriceConfirm?$format=json");
    expect(listTools()[2].endpoint).toBe("GET /api/v1/hotel/details");
    expect(listTools()[3].endpoint).toBe("POST /api/booking/HotelBookingConfirm?$format=json");
    expect(listTools()[4].endpoint).toBe("POST /api/booking/HotelBookingSearch?$format=json");
    expect(listTools()[5].endpoint).toBe("POST /api/booking/HotelBookingCancel?$format=json");
    expect(listTools()[6].endpoint).toBe("POST /api/booking/HotelBookingCancelConfirm?$format=json");
  });

  it("marks booking as approval-worthy and discovery tools as read-only", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const searchHotels = tools.find((tool) => tool.name === "dida_demo_search_hotels");
    const hotelDetails = tools.find((tool) => tool.name === "dida_demo_get_hotel_details");
    const bookHotel = tools.find((tool) => tool.name === "dida_demo_book_hotel");
    const preCancel = tools.find((tool) => tool.name === "dida_demo_pre_cancel_booking");
    const cancel = tools.find((tool) => tool.name === "dida_demo_cancel_booking");
    const modify = tools.find((tool) => tool.name === "dida_demo_modify_booking");
    expect(searchHotels?.annotations?.readOnlyHint).toBe(true);
    expect(searchHotels?.annotations?.destructiveHint).toBe(false);
    expect(hotelDetails?.annotations?.readOnlyHint).toBe(true);
    expect(hotelDetails?._meta?.["sentura/endpoint"]).toBe("GET /api/v1/hotel/details");
    expect(preCancel?.annotations?.readOnlyHint).toBe(true);
    expect(preCancel?.annotations?.destructiveHint).toBe(false);
    expect(cancel?.annotations?.readOnlyHint).toBe(false);
    expect(cancel?.annotations?.destructiveHint).toBe(true);
    expect(modify?.annotations?.readOnlyHint).toBe(false);
    expect(modify?.annotations?.destructiveHint).toBe(true);
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
    expect(search.hotels).toHaveLength(5);
    expect(firstHotel.hotelNameZh).toBe("深圳湾安达仕酒店");
    expect(firstHotel.roomNameZh).toBe("湾景大床房");
    expect(firstHotel.cancellationPolicyZh).toContain("免费取消");
    expect(firstHotel.displaySummaryZh).toContain("深圳湾安达仕酒店");
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
    expect(confirmed.hotelNameZh).toBe("深圳湾安达仕酒店");
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
    expect(booked.hotelNameZh).toBe("深圳湾安达仕酒店");
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

  it("returns Dida Content API style hotel details for clickable hotel lookup", async () => {
    const { client } = await connect();
    const details = parseToolResult(
      await client.callTool({
        name: "dida_demo_get_hotel_details",
        arguments: {
          hotelIds: ["DIDA-SZX-10001"],
          language: "zh-CN",
        },
      }),
    );
    const hotel = (details.hotels as Array<Record<string, unknown>>)[0];
    expect(details).toMatchObject({
      source: "demo-fixture",
      locale: "zh-CN",
      didaEndpoint: "GET /api/v1/hotel/details",
    });
    expect(details.requestModel).toMatchObject({
      hotelIds: ["DIDA-SZX-10001"],
      language: "zh-CN",
    });
    expect(hotel).toMatchObject({
      hotelId: "DIDA-SZX-10001",
      hotelNameZh: "深圳湾安达仕酒店",
      districtZh: "南山",
      addressZh: "深圳市南山区科苑南路 2600 号",
      descriptionZh: expect.stringContaining("深圳湾片区"),
      facilitiesZh: expect.arrayContaining(["免费 Wi-Fi", "健身房"]),
      nearbyZh: expect.arrayContaining(["深圳湾公园"]),
      checkInInstructionsZh: expect.arrayContaining([expect.stringContaining("建议 14:00 后办理入住")]),
    });
    expect(hotel.geo).toMatchObject({ latitude: 22.5166, longitude: 113.9448 });
    expect(hotel.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: expect.stringContaining("dida-szx-10001"),
          captionZh: expect.stringContaining("示意图"),
        }),
      ]),
    );
    expect((hotel.rooms as Array<Record<string, unknown>>)[0]).toMatchObject({
      ratePlanId: "RP-SZX-BAY-BB",
      roomNameZh: "湾景大床房",
      metadata: "DIDA_META_SZX_BAY_20260611_20260615_RP_BB",
    });
    expect(hotel.displaySummaryZh).toContain("主要设施");
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

  it("runs BookingCancel pre-cancel -> CancelConfirm and then BookingSearch returns status 3", () => {
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
    const booking = demo.bookHotel({
      referenceNo: confirmed.referenceNo,
      contact,
      guestList,
      clientReference: "ZUOLIAN-CANCEL-001",
    }) as Record<string, unknown>;

    const preCancel = demo.preCancelBooking({
      bookingId: booking.bookingId,
      reason: "用户不去了",
    }) as Record<string, unknown>;
    expect(preCancel).toMatchObject({
      didaEndpoint: "POST /api/booking/HotelBookingCancel?$format=json",
      bookingId: booking.bookingId,
      amountCny: 0,
      refundAmountCny: 3920,
      preCancelOnly: true,
      statusAfterPreCancel: 2,
    });
    expect(preCancel.confirmId).toMatch(/^DIDA-CXL-ZL-/);
    expect((demo.getBooking({ bookingId: booking.bookingId }) as Record<string, unknown>).status).toBe(2);

    const canceled = demo.cancelBooking({
      bookingId: booking.bookingId,
      confirmId: preCancel.confirmId,
      description: "用户不去了",
    }) as Record<string, unknown>;
    expect(canceled).toMatchObject({
      didaEndpoint: "POST /api/booking/HotelBookingCancelConfirm?$format=json",
      bookingId: booking.bookingId,
      status: 3,
      statusName: "Canceled",
      statusNameZh: "已取消",
      final: true,
      cancellationFeeCny: 0,
      refundAmountCny: 3920,
    });

    const order = demo.getBooking({ bookingId: booking.bookingId }) as Record<string, unknown>;
    expect(order.status).toBe(3);
    expect(order.displaySummaryZh).toContain("Dida 状态 3 Canceled");
  });

  it("rejects CancelConfirm without a valid pre-cancel ConfirmID", () => {
    const demo = new DidaTravelDemoClient(loadConfigFromEnv({}));
    expect(() => demo.cancelBooking({ confirmId: "DIDA-CXL-ZL-MISSING" })).toThrow(/pre-cancel/);
  });

  it("modifies booking by canceling the old order and rebooking with updated details", () => {
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
    const booking = demo.bookHotel({
      referenceNo: confirmed.referenceNo,
      contact,
      guestList,
      clientReference: "ZUOLIAN-MOD-001",
    }) as Record<string, unknown>;

    const modified = demo.modifyBooking({
      bookingId: booking.bookingId,
      reason: "用户希望改到福田中心区",
      city: "深圳",
      hotelId: "DIDA-SZX-10002",
      ratePlanId: "RP-SZX-FTN-RO",
      checkInDate: "2026-06-12",
      checkOutDate: "2026-06-16",
      roomCount: 1,
      adultCount: 2,
      childCount: 0,
      clientReference: "ZUOLIAN-MOD-001-NEW",
    }) as Record<string, unknown>;

    expect(modified.toolOrder).toEqual([
      "BookingCancel.PreCancel",
      "BookingCancel.CancelConfirm",
      "PriceSearch",
      "PriceConfirm(preBook=true)",
      "BookingConfirm",
    ]);
    expect(modified.oldBooking).toMatchObject({
      bookingId: booking.bookingId,
      status: 3,
      replacementBookingId: "DIDA-BOOK-ZL-000002",
    });
    expect(modified.newBooking).toMatchObject({
      bookingId: "DIDA-BOOK-ZL-000002",
      status: 2,
      hotelId: "DIDA-SZX-10002",
      hotelNameZh: "深圳四季酒店",
      checkInDate: "2026-06-12",
      checkOutDate: "2026-06-16",
      modifiedFromBookingId: booking.bookingId,
    });
    expect(modified.displaySummaryZh).toContain("旧订单 DIDA-BOOK-ZL-000001 已取消");
    expect(modified.displaySummaryZh).toContain("新订单 DIDA-BOOK-ZL-000002");
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
    expect(attractions.options).toHaveLength(5);
  });

  it("covers each supported destination city with 5 hotels and 5 attractions", () => {
    const demo = new DidaTravelDemoClient(loadConfigFromEnv({}));
    for (const city of ["深圳", "广州", "北京", "上海", "杭州", "香港", "澳门"]) {
      const search = demo.searchHotels({
        city,
        checkInDate: "2026-06-11",
        checkOutDate: "2026-06-15",
        childCount: 0,
      }) as Record<string, unknown>;
      const attractionSearch = demo.searchAttractions({
        city,
        startDate: "2026-06-11",
        endDate: "2026-06-15",
        travelers: 2,
      }) as Record<string, unknown>;
      expect(search.hotels, `${city} hotels`).toHaveLength(5);
      expect(attractionSearch.options, `${city} attractions`).toHaveLength(5);
    }
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
      hotelNameZh: "深圳湾安达仕酒店",
      roomNameZh: "湾景大床房",
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
      locale: "zh-CN",
      transferNameZh: "深圳宝安国际机场至南山酒店专车",
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
