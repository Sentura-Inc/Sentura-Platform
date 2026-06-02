#!/usr/bin/env node
/**
 * Sentura DidaTravel Demo — fixture-first MCP server for 座联互动 Phase 1.
 *
 * Milestone 1 intentionally does not call DidaTravel over the network. It keeps
 * Dida's official Booking API ordering and terminal status semantics so the
 * later real proxy can replace fixtures without changing agent behavior.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DIDA_BOOKING_BASE_URL = "https://apiint.didatravel.com";
const DIDA_CONTENT_BASE_URL = "https://static-apiint.didatravel.com";
const DISPLAY_LOCALE = "zh-CN";

const SOURCE = {
  priceSearch: "https://apidoc.didatravel.com/booking-api/price-search.html",
  priceConfirm: "https://apidoc.didatravel.com/booking-api/price-confirm.html",
  bookingConfirm: "https://apidoc.didatravel.com/booking-api/booking-confirm.html",
  bookingSearch: "https://apidoc.didatravel.com/booking-api/booking-search.html",
  content: "https://apidoc.didatravel.com/content-api-v2/how-to-use-content-api.html",
} as const;

const ENDPOINT = {
  priceSearch: "POST /api/rate/pricesearch?$format=json",
  priceConfirm: "POST /api/rate/PriceConfirm?$format=json",
  bookingConfirm: "POST /api/booking/HotelBookingConfirm?$format=json",
  bookingSearch: "POST /api/booking/HotelBookingSearch?$format=json",
  hotelList: "GET /api/v1/hotel/list",
  hotelDetails: "GET /api/v1/hotel/details",
} as const;

const ConfigSchema = z.object({
  mode: z.enum(["fixture", "proxy-disabled"]).default("fixture"),
  bookingBaseUrl: z.string().url().default(DIDA_BOOKING_BASE_URL),
  contentBaseUrl: z.string().url().default(DIDA_CONTENT_BASE_URL),
  clientId: z.string().min(1).optional(),
  licenseKey: z.string().min(1).optional(),
});

export type DidaTravelDemoConfig = z.infer<typeof ConfigSchema>;

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DidaTravelDemoConfig {
  return ConfigSchema.parse({
    mode: env.DIDA_DEMO_MODE ?? "fixture",
    bookingBaseUrl: env.DIDA_BOOKING_BASE_URL ?? DIDA_BOOKING_BASE_URL,
    contentBaseUrl: env.DIDA_CONTENT_BASE_URL ?? DIDA_CONTENT_BASE_URL,
    clientId: env.DIDA_CLIENT_ID,
    licenseKey: env.DIDA_LICENSE_KEY,
  });
}

export class DidaTravelDemoError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DidaTravelDemoError";
  }
}

const GuestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(0).max(120).optional(),
});

const ContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email(),
});

const DidaStatusSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
type DidaBookingStatus = z.infer<typeof DidaStatusSchema>;

const DIDA_STATUS: Record<DidaBookingStatus, { label: string; labelZh: string; final: boolean }> = {
  0: { label: "PreBook", labelZh: "预占中", final: false },
  1: { label: "BookedOrAwaitingPayment", labelZh: "已创建，待处理", final: false },
  2: { label: "Confirmed", labelZh: "已确认", final: true },
  3: { label: "Canceled", labelZh: "已取消", final: true },
  4: { label: "Failed", labelZh: "预订失败", final: true },
  5: { label: "PendingInProcess", labelZh: "处理中", final: false },
  6: { label: "OnRequest", labelZh: "待供应商确认", final: false },
};

const hotels = [
  {
    hotelId: "DIDA-SZX-10001",
    hotelName: "Shenzhen Bay Coastal Hotel",
    hotelNameZh: "深圳湾海景臻选酒店",
    destinationCode: "CN-SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Nanshan",
    districtZh: "南山",
    address: "No. 1188 Wanghai Road, Nanshan, Shenzhen",
    addressZh: "深圳市南山区望海路 1188 号",
    starRating: 5,
    hotelListEndpoint: ENDPOINT.hotelList,
    hotelDetailsEndpoint: ENDPOINT.hotelDetails,
    room: {
      roomTypeCode: "DLX-BAY-KING",
      roomName: "Deluxe Bay View King Room",
      roomNameZh: "豪华湾景大床房",
      ratePlanId: "RP-SZX-BAY-BB",
      boardName: "Breakfast included",
      boardNameZh: "含早餐",
      pricePerRoomCny: 980,
      cancellationPolicy: "Free cancellation before 2026-06-10 18:00 China time.",
      cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
      metadata: "DIDA_META_SZX_BAY_20260611_20260615_RP_BB",
    },
    sellingPointsZh: ["深圳湾片区", "适合城市海景和休闲行程", "近地铁，含早餐"],
    tags: ["family", "bay-view", "metro", "breakfast"],
  },
  {
    hotelId: "DIDA-SZX-10002",
    hotelName: "Futian Civic Center Executive Hotel",
    hotelNameZh: "福田市民中心行政酒店",
    destinationCode: "CN-SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Futian",
    districtZh: "福田",
    address: "No. 3009 Fuzhong Road, Futian, Shenzhen",
    addressZh: "深圳市福田区福中路 3009 号",
    starRating: 4,
    hotelListEndpoint: ENDPOINT.hotelList,
    hotelDetailsEndpoint: ENDPOINT.hotelDetails,
    room: {
      roomTypeCode: "SUP-CITY-TWIN",
      roomName: "Superior City Twin Room",
      roomNameZh: "高级城景双床房",
      ratePlanId: "RP-SZX-FTN-RO",
      boardName: "Room only",
      boardNameZh: "不含早餐",
      pricePerRoomCny: 690,
      cancellationPolicy: "Non-refundable after booking confirmation.",
      cancellationPolicyZh: "预订确认后不可取消退款。",
      metadata: "DIDA_META_SZX_FTN_20260611_20260615_RP_RO",
    },
    sellingPointsZh: ["福田中心区", "商务与购物动线方便", "预算更友好"],
    tags: ["business", "metro", "shopping"],
  },
  {
    hotelId: "DIDA-SZX-10003",
    hotelName: "OCT Harbor Family Resort",
    hotelNameZh: "华侨城欢乐海岸亲子度假酒店",
    destinationCode: "CN-SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Nanshan",
    districtZh: "南山",
    address: "No. 8 Baishi Road East, Nanshan, Shenzhen",
    addressZh: "深圳市南山区白石路东 8 号",
    starRating: 5,
    hotelListEndpoint: ENDPOINT.hotelList,
    hotelDetailsEndpoint: ENDPOINT.hotelDetails,
    room: {
      roomTypeCode: "FAM-SUITE",
      roomName: "Family Suite",
      roomNameZh: "亲子套房",
      ratePlanId: "RP-SZX-OCT-FAM",
      boardName: "Breakfast included",
      boardNameZh: "含早餐",
      pricePerRoomCny: 1280,
      cancellationPolicy: "Free cancellation before 2026-06-09 18:00 China time.",
      cancellationPolicyZh: "北京时间 2026-06-09 18:00 前可免费取消。",
      metadata: "DIDA_META_SZX_OCT_20260611_20260615_RP_FAM",
    },
    sellingPointsZh: ["欢乐海岸附近", "适合亲子和轻度度假", "房型空间更宽松"],
    tags: ["family", "theme-park", "breakfast"],
  },
] as const;

const transfers = [
  {
    transferId: "SZX-TRANSFER-AIRPORT-NANSHAN-7",
    name: "Shenzhen Bao'an Airport to Nanshan hotel",
    transferNameZh: "深圳宝安机场至南山酒店专车",
    vehicleClass: "Business 7-seater",
    vehicleClassZh: "商务 7 座车",
    maxPassengers: 6,
    priceCny: 388,
    includes: ["Meet-and-greet", "90 minutes free waiting", "Flight delay monitoring"],
    includesZh: ["举牌接机", "免费等候 90 分钟", "航班延误监测"],
  },
  {
    transferId: "SZX-TRANSFER-AIRPORT-FUTIAN-5",
    name: "Shenzhen Bao'an Airport to Futian hotel",
    transferNameZh: "深圳宝安机场至福田酒店专车",
    vehicleClass: "Comfort 5-seater",
    vehicleClassZh: "舒适 5 座车",
    maxPassengers: 3,
    priceCny: 268,
    includes: ["Airport pickup", "60 minutes free waiting"],
    includesZh: ["机场接机", "免费等候 60 分钟"],
  },
] as const;

const attractions = [
  {
    attractionId: "SZX-TICKET-WINDOW-WORLD",
    name: "Window of the World",
    attractionNameZh: "世界之窗",
    district: "Nanshan",
    districtZh: "南山",
    ticketType: "Adult day ticket",
    ticketTypeZh: "成人日场票",
    priceCny: 220,
    recommendedDay: 2,
  },
  {
    attractionId: "SZX-TICKET-SPLENDID-CHINA",
    name: "Splendid China Folk Village",
    attractionNameZh: "锦绣中华民俗村",
    district: "Nanshan",
    districtZh: "南山",
    ticketType: "Adult day ticket",
    ticketTypeZh: "成人日场票",
    priceCny: 198,
    recommendedDay: 3,
  },
  {
    attractionId: "SZX-TICKET-PINGAN-FC",
    name: "Ping An Finance Center Free Sky",
    attractionNameZh: "平安金融中心云际观光层",
    district: "Futian",
    districtZh: "福田",
    ticketType: "Observation deck ticket",
    ticketTypeZh: "观光层门票",
    priceCny: 180,
    recommendedDay: 4,
  },
] as const;

export interface ConfirmedRate {
  referenceNo?: string;
  preBook: boolean;
  hotelId: string;
  ratePlanId: string;
  checkInDate: string;
  checkOutDate: string;
  roomCount: number;
  adultCount: number;
  childCount: number;
  currency: "CNY";
  finalTotalCny: number;
  metadata: string;
}

export interface DemoBooking {
  bookingId: string;
  referenceNo: string;
  clientReference?: string;
  status: DidaBookingStatus;
  hotelId: string;
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  contact: z.infer<typeof ContactSchema>;
  guestList: Array<{ roomIndex: number; guests: Array<z.infer<typeof GuestSchema>> }>;
  totalCny: number;
}

export class DidaTravelDemoClient {
  private referenceSeq = 1;
  private bookingSeq = 1;
  private readonly confirmedRates = new Map<string, ConfirmedRate>();
  private readonly bookings = new Map<string, DemoBooking>();
  private readonly referenceToBooking = new Map<string, string>();

  constructor(public readonly config: DidaTravelDemoConfig) {}

  searchHotels(args: Record<string, unknown>) {
    const input = z
      .object({
        city: z.string().default("Shenzhen"),
        checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        roomCount: z.number().int().min(1).max(4).default(1),
        adultCount: z.number().int().min(1).max(8).default(2),
        childCount: z.number().int().min(0).max(6).default(0),
        childAges: z.array(z.number().int().min(0).max(17)).default([]),
        nationality: z.string().length(2).default("CN"),
        budgetMaxCny: z.number().int().positive().optional(),
        preferences: z.array(z.string()).default([]),
      })
      .parse(args);

    this.assertChildAges(input.childCount, input.childAges);
    const city = normalizeCity(input.city);
    const nights = nightsBetween(input.checkInDate, input.checkOutDate);
    const filtered = hotels
      .filter((hotel) => normalizeCity(hotel.city) === city)
      .filter((hotel) => !input.budgetMaxCny || hotel.room.pricePerRoomCny <= input.budgetMaxCny)
      .map((hotel) => ({
        locale: DISPLAY_LOCALE,
        hotelId: hotel.hotelId,
        hotelName: hotel.hotelName,
        hotelNameZh: hotel.hotelNameZh,
        destinationCode: hotel.destinationCode,
        city: hotel.city,
        cityZh: hotel.cityZh,
        district: hotel.district,
        districtZh: hotel.districtZh,
        address: hotel.address,
        addressZh: hotel.addressZh,
        starRating: hotel.starRating,
        roomTypeCode: hotel.room.roomTypeCode,
        roomName: hotel.room.roomName,
        roomNameZh: hotel.room.roomNameZh,
        ratePlanId: hotel.room.ratePlanId,
        boardName: hotel.room.boardName,
        boardNameZh: hotel.room.boardNameZh,
        currency: "CNY",
        roomStatus: "Available",
        roomStatusZh: "可预订",
        pricePerRoomCny: hotel.room.pricePerRoomCny,
        estimatedTotalCny: hotel.room.pricePerRoomCny * input.roomCount * nights,
        cancellationPolicy: hotel.room.cancellationPolicy,
        cancellationPolicyZh: hotel.room.cancellationPolicyZh,
        metadata: hotel.room.metadata,
        sellingPointsZh: hotel.sellingPointsZh,
        displaySummaryZh: `${hotel.hotelNameZh}，${hotel.districtZh}，${hotel.room.roomNameZh}，每晚每间约 CNY ${hotel.room.pricePerRoomCny}，${hotel.room.cancellationPolicyZh}`,
        tags: hotel.tags,
      }));

    return {
      source: "demo-fixture",
      locale: DISPLAY_LOCALE,
      didaEndpoint: ENDPOINT.priceSearch,
      didaContentEndpoints: [ENDPOINT.hotelList, ENDPOINT.hotelDetails],
      didaDocs: [SOURCE.priceSearch, SOURCE.content],
      requestModel: {
        HotelIDList: filtered.map((hotel) => hotel.hotelId),
        CheckInDate: input.checkInDate,
        CheckOutDate: input.checkOutDate,
        IsRealTime: { Value: true, RoomCount: input.roomCount },
        RealTimeOccupancy: {
          AdultCount: input.adultCount,
          ChildCount: input.childCount,
          ChildAgeDetails: input.childAges,
        },
        Currency: "CNY",
        Nationality: input.nationality,
      },
      hotels: filtered,
    };
  }

  priceConfirm(args: Record<string, unknown>): ConfirmedRate {
    const input = z
      .object({
        hotelId: z.string().min(1),
        ratePlanId: z.string().min(1),
        checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        roomCount: z.number().int().min(1).max(4).default(1),
        adultCount: z.number().int().min(1).max(8).default(2),
        childCount: z.number().int().min(0).max(6).default(0),
        childAges: z.array(z.number().int().min(0).max(17)).default([]),
        nationality: z.string().length(2).default("CN"),
        metadata: z.string().min(1),
        preBook: z.boolean().default(true),
      })
      .parse(args);

    this.assertChildAges(input.childCount, input.childAges);
    const hotel = this.findHotel(input.hotelId, input.ratePlanId);
    if (hotel.room.metadata !== input.metadata) {
      throw new DidaTravelDemoError(
        "Dida PriceConfirm must receive the Metadata returned by PriceSearch unchanged.",
        "metadata_mismatch",
      );
    }

    const nights = nightsBetween(input.checkInDate, input.checkOutDate);
    const confirmed: ConfirmedRate = {
      referenceNo: input.preBook ? this.nextReferenceNo() : undefined,
      preBook: input.preBook,
      hotelId: input.hotelId,
      ratePlanId: input.ratePlanId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      roomCount: input.roomCount,
      adultCount: input.adultCount,
      childCount: input.childCount,
      currency: "CNY",
      finalTotalCny: hotel.room.pricePerRoomCny * input.roomCount * nights,
      metadata: input.metadata,
    };

    if (confirmed.referenceNo) this.confirmedRates.set(confirmed.referenceNo, confirmed);
    return {
      ...confirmed,
      locale: DISPLAY_LOCALE,
      didaEndpoint: ENDPOINT.priceConfirm,
      didaDocs: [SOURCE.priceConfirm],
      hotelNameZh: hotel.hotelNameZh,
      roomNameZh: hotel.room.roomNameZh,
      boardNameZh: hotel.room.boardNameZh,
      finalCancellationPolicy: hotel.room.cancellationPolicy,
      finalCancellationPolicyZh: hotel.room.cancellationPolicyZh,
      displaySummaryZh: `${hotel.hotelNameZh} ${hotel.room.roomNameZh} 已完成价格确认，${input.roomCount} 间 ${nights} 晚总价 CNY ${confirmed.finalTotalCny}。${hotel.room.cancellationPolicyZh}`,
      note:
        input.preBook
          ? "PreBook=true generated a ReferenceNo for BookingConfirm."
          : "PreBook=false confirmed price only; BookingConfirm is not allowed.",
      noteZh:
        input.preBook
          ? "PreBook=true 已生成可用于 BookingConfirm 的 ReferenceNo。"
          : "PreBook=false 仅确认价格，不允许继续创建 BookingConfirm。",
    } as ConfirmedRate & Record<string, unknown>;
  }

  bookHotel(args: Record<string, unknown>) {
    const input = z
      .object({
        referenceNo: z.string().min(1),
        contact: ContactSchema,
        guestList: z
          .array(
            z.object({
              roomIndex: z.number().int().min(1),
              guests: z.array(GuestSchema).min(1),
            }),
          )
          .min(1),
        customerRequest: z.string().max(500).optional(),
        clientReference: z.string().min(1).optional(),
        simulateStatus: DidaStatusSchema.default(2),
      })
      .parse(args);

    const confirmed = this.confirmedRates.get(input.referenceNo);
    if (!confirmed) {
      throw new DidaTravelDemoError(
        "BookingConfirm requires a ReferenceNo generated by PriceConfirm with PreBook=true.",
        "reference_not_found",
      );
    }
    if (this.referenceToBooking.has(input.referenceNo)) {
      throw new DidaTravelDemoError(
        "This ReferenceNo has already been consumed by a BookingConfirm call.",
        "reference_already_booked",
      );
    }

    const hotel = this.findHotel(confirmed.hotelId, confirmed.ratePlanId);
    const bookingId = this.nextBookingId();
    const booking: DemoBooking = {
      bookingId,
      referenceNo: input.referenceNo,
      clientReference: input.clientReference,
      status: input.simulateStatus,
      hotelId: confirmed.hotelId,
      hotelName: hotel.hotelName,
      checkInDate: confirmed.checkInDate,
      checkOutDate: confirmed.checkOutDate,
      contact: input.contact,
      guestList: input.guestList,
      totalCny: confirmed.finalTotalCny,
    };
    this.bookings.set(bookingId, booking);
    this.referenceToBooking.set(input.referenceNo, bookingId);

    return {
      source: "demo-fixture",
      didaEndpoint: ENDPOINT.bookingConfirm,
      didaDocs: [SOURCE.bookingConfirm],
      ...this.renderBooking(booking),
      customerRequest: input.customerRequest,
      confirmationMessage:
        DIDA_STATUS[booking.status].final && booking.status === 2
          ? "Hotel booking confirmed. Send this order summary to the customer."
          : "Booking created but not in a final success state; poll BookingSearch before promising completion.",
      confirmationMessageZh:
        DIDA_STATUS[booking.status].final && booking.status === 2
          ? "酒店预订已确认，可将订单摘要发送给用户。"
          : "订单已创建，但还不是最终成功状态；继续查询 BookingSearch 后再向用户承诺完成。",
    };
  }

  getBooking(args: Record<string, unknown>) {
    const input = z
      .object({
        bookingId: z.string().min(1).optional(),
        referenceNo: z.string().min(1).optional(),
      })
      .refine((value) => Boolean(value.bookingId || value.referenceNo), {
        message: "bookingId or referenceNo is required",
      })
      .parse(args);

    const bookingId =
      input.bookingId ?? (input.referenceNo ? this.referenceToBooking.get(input.referenceNo) : undefined);
    if (!bookingId) {
      throw new DidaTravelDemoError("No booking found for the supplied identifier.", "booking_not_found");
    }
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      throw new DidaTravelDemoError("No booking found for the supplied identifier.", "booking_not_found");
    }
    return {
      source: "demo-fixture",
      didaEndpoint: ENDPOINT.bookingSearch,
      didaDocs: [SOURCE.bookingSearch],
      ...this.renderBooking(booking),
      safetyMessage:
        DIDA_STATUS[booking.status].final
          ? "This is a Dida final status."
          : "This is not final. Continue polling before confirming success, cancellation, or failure to the customer.",
      safetyMessageZh:
        DIDA_STATUS[booking.status].final
          ? "这是 Dida 最终状态，可以按状态向用户说明结果。"
          : "这不是最终状态，需要继续查询后才能向用户确认成功、取消或失败。",
    };
  }

  searchTransfers(args: Record<string, unknown>) {
    const input = z
      .object({
        pickup: z.string().min(1),
        dropoff: z.string().min(1),
        pickupDateTime: z.string().min(16),
        passengers: z.number().int().min(1).max(6).default(2),
      })
      .parse(args);
    return {
      source: "demo-fixture",
      locale: DISPLAY_LOCALE,
      didaEndpoint: "Dida transfer API not in Milestone 1 official docs; local fixture only",
      query: input,
      options: transfers
        .filter((transfer) => transfer.maxPassengers >= input.passengers)
        .map((transfer) => ({
          ...transfer,
          locale: DISPLAY_LOCALE,
          displaySummaryZh: `${transfer.transferNameZh}，${transfer.vehicleClassZh}，最多 ${transfer.maxPassengers} 人，CNY ${transfer.priceCny}，包含：${transfer.includesZh.join("、")}。`,
        })),
    };
  }

  searchAttractions(args: Record<string, unknown>) {
    const input = z
      .object({
        city: z.string().default("Shenzhen"),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        travelers: z.number().int().min(1).max(8).default(2),
        preferences: z.array(z.string()).default([]),
      })
      .parse(args);
    return {
      source: "demo-fixture",
      locale: DISPLAY_LOCALE,
      didaEndpoint: "Dida attraction API not in Milestone 1 official docs; local fixture only",
      query: input,
      options: attractions.map((attraction) => ({
        ...attraction,
        locale: DISPLAY_LOCALE,
        estimatedTotalCny: attraction.priceCny * input.travelers,
        displaySummaryZh: `${attraction.attractionNameZh}，${attraction.districtZh}，${attraction.ticketTypeZh}，建议第 ${attraction.recommendedDay} 天安排，${input.travelers} 人预计 CNY ${attraction.priceCny * input.travelers}。`,
      })),
    };
  }

  private assertChildAges(childCount: number, childAges: number[]) {
    if (childAges.length !== childCount) {
      throw new DidaTravelDemoError(
        "Dida occupancy requires one child age entry for each child.",
        "child_age_count_mismatch",
      );
    }
  }

  private findHotel(hotelId: string, ratePlanId: string) {
    const hotel = hotels.find((candidate) => candidate.hotelId === hotelId && candidate.room.ratePlanId === ratePlanId);
    if (!hotel) {
      throw new DidaTravelDemoError("No demo hotel/rate plan matches the supplied identifiers.", "rate_not_found");
    }
    return hotel;
  }

  private nextReferenceNo() {
    return `DIDA-PRE-ZL-${String(this.referenceSeq++).padStart(6, "0")}`;
  }

  private nextBookingId() {
    return `DIDA-BOOK-ZL-${String(this.bookingSeq++).padStart(6, "0")}`;
  }

  private renderBooking(booking: DemoBooking) {
    const status = DIDA_STATUS[booking.status];
    const hotel = hotels.find((candidate) => candidate.hotelId === booking.hotelId);
    return {
      locale: DISPLAY_LOCALE,
      bookingId: booking.bookingId,
      referenceNo: booking.referenceNo,
      clientReference: booking.clientReference,
      status: booking.status,
      statusName: status.label,
      statusNameZh: status.labelZh,
      final: status.final,
      hotelId: booking.hotelId,
      hotelName: booking.hotelName,
      hotelNameZh: hotel?.hotelNameZh ?? booking.hotelName,
      roomNameZh: hotel?.room.roomNameZh,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      totalCny: booking.totalCny,
      contact: booking.contact,
      guestList: booking.guestList,
      displaySummaryZh: `订单 ${booking.bookingId}：${hotel?.hotelNameZh ?? booking.hotelName}，${booking.checkInDate} 至 ${booking.checkOutDate}，总价 CNY ${booking.totalCny}，当前状态：${status.labelZh}（Dida 状态 ${booking.status} ${status.label}）。`,
    };
  }
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputShape: Record<string, z.ZodTypeAny>;
  endpoint: string;
  source: string;
  readOnly: boolean;
  destructive: boolean;
  handler: (client: DidaTravelDemoClient, args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export function listTools(): ToolDef[] {
  return [
    {
      name: "dida_demo_search_hotels",
      title: "Search Shenzhen hotels",
      description:
        "Fixture simulation of Dida PriceSearch for Shenzhen hotels. Returns hotel/rate candidates and the Metadata that PriceConfirm must reuse unchanged.",
      inputShape: {
        city: z.string().default("Shenzhen"),
        checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        roomCount: z.number().int().min(1).max(4).default(1),
        adultCount: z.number().int().min(1).max(8).default(2),
        childCount: z.number().int().min(0).max(6).default(0),
        childAges: z.array(z.number().int().min(0).max(17)).default([]),
        nationality: z.string().length(2).default("CN"),
        budgetMaxCny: z.number().int().positive().optional(),
        preferences: z.array(z.string()).default([]),
      },
      endpoint: ENDPOINT.priceSearch,
      source: `${SOURCE.priceSearch} + ${SOURCE.content}`,
      readOnly: true,
      destructive: false,
      handler: (client, args) => client.searchHotels(args),
    },
    {
      name: "dida_demo_price_confirm",
      title: "Confirm hotel price",
      description:
        "Fixture simulation of Dida PriceConfirm. Use preBook=true to generate the ReferenceNo required by HotelBookingConfirm.",
      inputShape: {
        hotelId: z.string().min(1),
        ratePlanId: z.string().min(1),
        checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        roomCount: z.number().int().min(1).max(4).default(1),
        adultCount: z.number().int().min(1).max(8).default(2),
        childCount: z.number().int().min(0).max(6).default(0),
        childAges: z.array(z.number().int().min(0).max(17)).default([]),
        nationality: z.string().length(2).default("CN"),
        metadata: z.string().min(1),
        preBook: z.boolean().default(true),
      },
      endpoint: ENDPOINT.priceConfirm,
      source: SOURCE.priceConfirm,
      readOnly: true,
      destructive: false,
      handler: (client, args) => client.priceConfirm(args),
    },
    {
      name: "dida_demo_book_hotel",
      title: "Book hotel",
      description:
        "Fixture simulation of Dida HotelBookingConfirm. Requires a ReferenceNo from PriceConfirm with preBook=true.",
      inputShape: {
        referenceNo: z.string().min(1),
        contact: ContactSchema,
        guestList: z
          .array(
            z.object({
              roomIndex: z.number().int().min(1),
              guests: z.array(GuestSchema).min(1),
            }),
          )
          .min(1),
        customerRequest: z.string().max(500).optional(),
        clientReference: z.string().min(1).optional(),
        simulateStatus: DidaStatusSchema.default(2),
      },
      endpoint: ENDPOINT.bookingConfirm,
      source: SOURCE.bookingConfirm,
      readOnly: false,
      destructive: true,
      handler: (client, args) => client.bookHotel(args),
    },
    {
      name: "dida_demo_get_booking",
      title: "Get booking order",
      description:
        "Fixture simulation of Dida HotelBookingSearch. Status 2/3/4 are final; 0/1/5/6 are not final.",
      inputShape: {
        bookingId: z.string().min(1).optional(),
        referenceNo: z.string().min(1).optional(),
      },
      endpoint: ENDPOINT.bookingSearch,
      source: SOURCE.bookingSearch,
      readOnly: true,
      destructive: false,
      handler: (client, args) => client.getBooking(args),
    },
    {
      name: "dida_demo_search_transfer",
      title: "Search airport transfer",
      description:
        "Local fixture search for Shenzhen airport transfer options used by the Phase 1 itinerary demo.",
      inputShape: {
        pickup: z.string().min(1),
        dropoff: z.string().min(1),
        pickupDateTime: z.string().min(16),
        passengers: z.number().int().min(1).max(6).default(2),
      },
      endpoint: "fixture:transfer-search",
      source: "座联互动/DESIGN.md Milestone 1 fixture",
      readOnly: true,
      destructive: false,
      handler: (client, args) => client.searchTransfers(args),
    },
    {
      name: "dida_demo_search_attractions",
      title: "Search Shenzhen attractions",
      description:
        "Local fixture search for Shenzhen attraction tickets used by the Phase 1 itinerary demo.",
      inputShape: {
        city: z.string().default("Shenzhen"),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        travelers: z.number().int().min(1).max(8).default(2),
        preferences: z.array(z.string()).default([]),
      },
      endpoint: "fixture:attraction-search",
      source: "座联互动/DESIGN.md Milestone 1 fixture",
      readOnly: true,
      destructive: false,
      handler: (client, args) => client.searchAttractions(args),
    },
  ];
}

export interface CreateServerOptions {
  config?: Partial<DidaTravelDemoConfig>;
}

export async function createServer(options: CreateServerOptions = {}) {
  const config: DidaTravelDemoConfig = { ...loadConfigFromEnv(), ...options.config };
  const client = new DidaTravelDemoClient(config);
  const server = new McpServer({
    name: "sentura-dida-travel-demo",
    version: "0.1.0",
  });

  for (const tool of listTools()) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputShape as Record<string, z.ZodTypeAny>,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: tool.destructive,
        },
        _meta: {
          "sentura/endpoint": tool.endpoint,
          "sentura/sourceDoc": tool.source,
          "sentura/demoMode": config.mode,
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(client, args);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const message =
            err instanceof DidaTravelDemoError
              ? `${err.code}: ${err.message}`
              : err instanceof Error
                ? err.message
                : String(err);
          return { isError: true, content: [{ type: "text" as const, text: message }] };
        }
      },
    );
  }

  return { server, client, config };
}

function nightsBetween(checkInDate: string, checkOutDate: string) {
  const start = Date.parse(`${checkInDate}T00:00:00.000Z`);
  const end = Date.parse(`${checkOutDate}T00:00:00.000Z`);
  const nights = Math.round((end - start) / 86_400_000);
  if (!Number.isFinite(nights) || nights <= 0) {
    throw new DidaTravelDemoError("CheckOutDate must be later than CheckInDate.", "invalid_stay_dates");
  }
  return nights;
}

function normalizeCity(city: string) {
  const trimmed = city.trim().toLowerCase();
  if (trimmed === "深圳" || trimmed === "深圳市" || trimmed === "shenzhen") return "shenzhen";
  return trimmed;
}

async function main() {
  const { server, config } = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[sentura-dida-travel-demo] MCP server started on stdio (${config.mode})`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error("[sentura-dida-travel-demo] fatal:", err);
    process.exit(1);
  });
}
