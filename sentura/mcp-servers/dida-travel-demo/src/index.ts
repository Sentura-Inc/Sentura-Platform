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

function hotelFixture(input: {
  hotelId: string;
  hotelName: string;
  hotelNameZh: string;
  destinationCode: string;
  city: string;
  cityZh: string;
  district: string;
  districtZh: string;
  addressZh: string;
  starRating: number;
  roomTypeCode: string;
  roomNameZh: string;
  ratePlanId: string;
  boardNameZh: string;
  pricePerRoomCny: number;
  cancellationPolicyZh: string;
  metadata: string;
  sellingPointsZh: string[];
  descriptionZh: string;
  facilitiesZh: string[];
  nearbyZh: string[];
  geo: { latitude: number; longitude: number };
  tags: string[];
}) {
  return {
    ...input,
    address: input.addressZh,
    hotelListEndpoint: ENDPOINT.hotelList,
    hotelDetailsEndpoint: ENDPOINT.hotelDetails,
    room: {
      roomTypeCode: input.roomTypeCode,
      roomName: input.roomNameZh,
      roomNameZh: input.roomNameZh,
      ratePlanId: input.ratePlanId,
      boardName: input.boardNameZh,
      boardNameZh: input.boardNameZh,
      pricePerRoomCny: input.pricePerRoomCny,
      cancellationPolicy: input.cancellationPolicyZh,
      cancellationPolicyZh: input.cancellationPolicyZh,
      metadata: input.metadata,
    },
    images: [
      {
        url: `https://static.demo.sentura.local/zuolian/hotels/${input.hotelId.toLowerCase()}-exterior.jpg`,
        captionZh: `${input.hotelNameZh}外观示意图`,
      },
      {
        url: `https://static.demo.sentura.local/zuolian/hotels/${input.hotelId.toLowerCase()}-room.jpg`,
        captionZh: `${input.roomNameZh}示意图`,
      },
    ],
    checkInInstructionsZh: [
      "建议 14:00 后办理入住，具体以酒店当天安排为准。",
      "入住人建议使用英文名或拼音名登记。",
      "早餐、取消政策和房态以 PriceConfirm 返回为准。",
    ],
  };
}

const hotels = [
  hotelFixture({
    hotelId: "DIDA-SZX-10001",
    hotelName: "Andaz Shenzhen Bay",
    hotelNameZh: "深圳湾安达仕酒店",
    destinationCode: "CN-SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Nanshan",
    districtZh: "南山",
    addressZh: "深圳市南山区科苑南路 2600 号",
    starRating: 5,
    roomTypeCode: "DLX-BAY-KING",
    roomNameZh: "湾景大床房",
    ratePlanId: "RP-SZX-BAY-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 980,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_SZX_BAY_20260611_20260615_RP_BB",
    sellingPointsZh: ["深圳湾片区", "适合城市海景和休闲行程", "近深圳湾公园"],
    descriptionZh: "深圳湾安达仕酒店位于深圳湾片区，适合想兼顾海景休闲、南山科技园和蛇口餐饮的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "餐厅", "行李寄存", "24 小时前台"],
    nearbyZh: ["深圳湾公园", "海上世界", "人才公园"],
    geo: { latitude: 22.5166, longitude: 113.9448 },
    tags: ["bay-view", "metro", "business", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-SZX-10002",
    hotelName: "Four Seasons Hotel Shenzhen",
    hotelNameZh: "深圳四季酒店",
    destinationCode: "CN-SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Futian",
    districtZh: "福田",
    addressZh: "深圳市福田区福华三路 138 号",
    starRating: 5,
    roomTypeCode: "SUP-CITY-TWIN",
    roomNameZh: "豪华城景双床房",
    ratePlanId: "RP-SZX-FTN-RO",
    boardNameZh: "不含早餐",
    pricePerRoomCny: 690,
    cancellationPolicyZh: "预订确认后不可取消退款。",
    metadata: "DIDA_META_SZX_FTN_20260611_20260615_RP_RO",
    sellingPointsZh: ["福田中心区", "近会展中心", "商务和购物动线方便"],
    descriptionZh: "深圳四季酒店位于福田核心区，适合希望减少通勤、兼顾商务、购物和城市观光的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "室内泳池", "健身房", "餐厅", "商务设施"],
    nearbyZh: ["会展中心", "平安金融中心", "市民中心"],
    geo: { latitude: 22.5375, longitude: 114.0542 },
    tags: ["business", "metro", "shopping"],
  }),
  hotelFixture({
    hotelId: "DIDA-SZX-10003",
    hotelName: "InterContinental Shenzhen Dameisha Resort",
    hotelNameZh: "深圳大梅沙京基洲际度假酒店",
    destinationCode: "CN-SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Yantian",
    districtZh: "盐田",
    addressZh: "深圳市盐田区大梅沙盐梅路 9 号",
    starRating: 5,
    roomTypeCode: "SEA-RESORT-KING",
    roomNameZh: "海景度假大床房",
    ratePlanId: "RP-SZX-OCT-FAM",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1280,
    cancellationPolicyZh: "北京时间 2026-06-09 18:00 前可免费取消。",
    metadata: "DIDA_META_SZX_OCT_20260611_20260615_RP_FAM",
    sellingPointsZh: ["大梅沙海滨", "适合度假", "亲子设施更完整"],
    descriptionZh: "深圳大梅沙京基洲际度假酒店靠近大梅沙海滨，适合想把海边休闲纳入深圳行程的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "室外泳池", "亲子设施", "餐厅", "海滨步道"],
    nearbyZh: ["大梅沙海滨公园", "小梅沙", "东部华侨城"],
    geo: { latitude: 22.5968, longitude: 114.3042 },
    tags: ["family", "beach", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-SZX-10004",
    hotelName: "The Langham, Shenzhen",
    hotelNameZh: "深圳东海朗廷酒店",
    destinationCode: "CN-SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Futian",
    districtZh: "福田",
    addressZh: "深圳市福田区深南大道 7888 号",
    starRating: 5,
    roomTypeCode: "DLX-CITY-KING",
    roomNameZh: "豪华城景大床房",
    ratePlanId: "RP-SZX-LGH-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 920,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_SZX_LGH_20260611_20260615_RP_BB",
    sellingPointsZh: ["深南大道沿线", "餐饮和购物方便", "适合城市探索"],
    descriptionZh: "深圳东海朗廷酒店位于福田深南大道沿线，适合希望住在成熟商圈并兼顾轻松出行的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "泳池", "下午茶", "行李寄存"],
    nearbyZh: ["车公庙", "香蜜湖", "购物公园"],
    geo: { latitude: 22.5357, longitude: 114.0282 },
    tags: ["shopping", "metro", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-SZX-10005",
    hotelName: "Shenzhen Marriott Hotel Nanshan",
    hotelNameZh: "深圳中洲万豪酒店",
    destinationCode: "CN-SZX",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Nanshan",
    districtZh: "南山",
    addressZh: "深圳市南山区海德一道 88 号中洲控股中心 A 座",
    starRating: 5,
    roomTypeCode: "EXEC-CITY-KING",
    roomNameZh: "行政城景大床房",
    ratePlanId: "RP-SZX-MRT-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1080,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_SZX_MRT_20260611_20260615_RP_BB",
    sellingPointsZh: ["南山中心区", "高层城市景观", "近深圳湾口岸"],
    descriptionZh: "深圳中洲万豪酒店位于南山中心区，适合南山科技、深圳湾和蛇口一线的行程安排。",
    facilitiesZh: ["免费 Wi-Fi", "行政酒廊", "健身房", "室内泳池", "餐厅"],
    nearbyZh: ["海岸城", "深圳湾口岸", "人才公园"],
    geo: { latitude: 22.5179, longitude: 113.9319 },
    tags: ["business", "bay-view", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-CAN-10001",
    hotelName: "White Swan Hotel Guangzhou",
    hotelNameZh: "广州白天鹅宾馆",
    destinationCode: "CN-CAN",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Liwan",
    districtZh: "荔湾",
    addressZh: "广州市荔湾区沙面南街 1 号",
    starRating: 5,
    roomTypeCode: "RIVERVIEW-KING",
    roomNameZh: "江景大床房",
    ratePlanId: "RP-CAN-WSH-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1180,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_CAN_WSH_20260611_20260615_RP_BB",
    sellingPointsZh: ["沙面岛", "珠江景观", "适合城市文化行程"],
    descriptionZh: "广州白天鹅宾馆位于沙面岛，适合想体验老广州建筑、珠江夜景和荔湾西关风情的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "餐厅", "江景房", "礼宾服务"],
    nearbyZh: ["沙面岛", "上下九步行街", "永庆坊"],
    geo: { latitude: 23.1087, longitude: 113.2389 },
    tags: ["heritage", "river-view", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-CAN-10002",
    hotelName: "Four Seasons Hotel Guangzhou",
    hotelNameZh: "广州四季酒店",
    destinationCode: "CN-CAN",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Tianhe",
    districtZh: "天河",
    addressZh: "广州市天河区珠江西路 5 号广州国际金融中心",
    starRating: 5,
    roomTypeCode: "SKYLINE-KING",
    roomNameZh: "天际景观大床房",
    ratePlanId: "RP-CAN-FS-RO",
    boardNameZh: "不含早餐",
    pricePerRoomCny: 1380,
    cancellationPolicyZh: "预订确认后不可取消退款。",
    metadata: "DIDA_META_CAN_FS_20260611_20260615_RP_RO",
    sellingPointsZh: ["珠江新城", "高层城市景观", "商务和观光兼顾"],
    descriptionZh: "广州四季酒店位于珠江新城核心区，适合希望靠近广州塔、花城广场和商务区的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "室内泳池", "健身房", "餐厅", "商务设施"],
    nearbyZh: ["花城广场", "广东省博物馆", "广州塔"],
    geo: { latitude: 23.1202, longitude: 113.3206 },
    tags: ["business", "city-view", "metro"],
  }),
  hotelFixture({
    hotelId: "DIDA-CAN-10003",
    hotelName: "The Ritz-Carlton Guangzhou",
    hotelNameZh: "广州富力丽思卡尔顿酒店",
    destinationCode: "CN-CAN",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Tianhe",
    districtZh: "天河",
    addressZh: "广州市天河区兴安路 3 号",
    starRating: 5,
    roomTypeCode: "CLUB-KING",
    roomNameZh: "行政大床房",
    ratePlanId: "RP-CAN-RC-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1280,
    cancellationPolicyZh: "北京时间 2026-06-09 18:00 前可免费取消。",
    metadata: "DIDA_META_CAN_RC_20260611_20260615_RP_BB",
    sellingPointsZh: ["近博物馆", "珠江新城", "服务稳定"],
    descriptionZh: "广州富力丽思卡尔顿酒店位于珠江新城，适合博物馆、歌剧院、广州塔和城市餐饮一线安排。",
    facilitiesZh: ["免费 Wi-Fi", "行政酒廊", "健身房", "餐厅", "礼宾服务"],
    nearbyZh: ["广东省博物馆", "广州大剧院", "花城广场"],
    geo: { latitude: 23.1173, longitude: 113.3228 },
    tags: ["business", "museum", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-CAN-10004",
    hotelName: "Mandarin Oriental Guangzhou",
    hotelNameZh: "广州文华东方酒店",
    destinationCode: "CN-CAN",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Tianhe",
    districtZh: "天河",
    addressZh: "广州市天河区天河路 389 号太古汇",
    starRating: 5,
    roomTypeCode: "DELUXE-KING",
    roomNameZh: "豪华大床房",
    ratePlanId: "RP-CAN-MO-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1520,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_CAN_MO_20260611_20260615_RP_BB",
    sellingPointsZh: ["太古汇", "购物餐饮方便", "地铁动线成熟"],
    descriptionZh: "广州文华东方酒店位于太古汇商圈，适合购物、美食和城市短途观光结合的行程。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "水疗", "餐厅", "商场连通"],
    nearbyZh: ["太古汇", "正佳广场", "体育西商圈"],
    geo: { latitude: 23.1341, longitude: 113.3313 },
    tags: ["shopping", "metro", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-CAN-10005",
    hotelName: "Langham Place Guangzhou",
    hotelNameZh: "广州南丰朗豪酒店",
    destinationCode: "CN-CAN",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Haizhu",
    districtZh: "海珠",
    addressZh: "广州市海珠区新港东路 638 号",
    starRating: 5,
    roomTypeCode: "RIVER-TWIN",
    roomNameZh: "江景双床房",
    ratePlanId: "RP-CAN-LP-RO",
    boardNameZh: "不含早餐",
    pricePerRoomCny: 760,
    cancellationPolicyZh: "北京时间 2026-06-08 18:00 前可免费取消。",
    metadata: "DIDA_META_CAN_LP_20260611_20260615_RP_RO",
    sellingPointsZh: ["琶洲会展", "近有轨电车", "价格更稳"],
    descriptionZh: "广州南丰朗豪酒店位于琶洲片区，适合会展、珠江沿线和海珠东部行程。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "泳池", "餐厅", "会议设施"],
    nearbyZh: ["广交会展馆", "琶洲塔", "广州塔有轨电车"],
    geo: { latitude: 23.1009, longitude: 113.3662 },
    tags: ["value", "business", "river-view"],
  }),
  hotelFixture({
    hotelId: "DIDA-BJS-10001",
    hotelName: "The Peninsula Beijing",
    hotelNameZh: "北京王府半岛酒店",
    destinationCode: "CN-BJS",
    city: "Beijing",
    cityZh: "北京",
    district: "Dongcheng",
    districtZh: "东城",
    addressZh: "北京市东城区金鱼胡同 8 号",
    starRating: 5,
    roomTypeCode: "SUITE-KING",
    roomNameZh: "豪华套房大床",
    ratePlanId: "RP-BJS-PEN-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1880,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_BJS_PEN_20260611_20260615_RP_BB",
    sellingPointsZh: ["王府井", "近故宫", "适合历史文化行程"],
    descriptionZh: "北京王府半岛酒店位于王府井与东单之间，适合故宫、天安门和东城胡同一线行程。",
    facilitiesZh: ["免费 Wi-Fi", "室内泳池", "健身房", "餐厅", "礼宾服务"],
    nearbyZh: ["王府井", "故宫博物院", "天安门广场"],
    geo: { latitude: 39.9154, longitude: 116.4112 },
    tags: ["heritage", "city-center", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-BJS-10002",
    hotelName: "Waldorf Astoria Beijing",
    hotelNameZh: "北京华尔道夫酒店",
    destinationCode: "CN-BJS",
    city: "Beijing",
    cityZh: "北京",
    district: "Dongcheng",
    districtZh: "东城",
    addressZh: "北京市东城区金鱼胡同 5-15 号",
    starRating: 5,
    roomTypeCode: "DELUXE-KING",
    roomNameZh: "豪华大床房",
    ratePlanId: "RP-BJS-WA-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1680,
    cancellationPolicyZh: "北京时间 2026-06-09 18:00 前可免费取消。",
    metadata: "DIDA_META_BJS_WA_20260611_20260615_RP_BB",
    sellingPointsZh: ["东城核心", "胡同和商业区兼顾", "安静精致"],
    descriptionZh: "北京华尔道夫酒店位于金鱼胡同，适合希望住在中心城区并保持安静住宿体验的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "水疗", "餐厅", "室内泳池"],
    nearbyZh: ["王府井", "东华门", "故宫博物院"],
    geo: { latitude: 39.9155, longitude: 116.4125 },
    tags: ["heritage", "shopping", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-BJS-10003",
    hotelName: "Aman Summer Palace",
    hotelNameZh: "北京颐和安缦",
    destinationCode: "CN-BJS",
    city: "Beijing",
    cityZh: "北京",
    district: "Haidian",
    districtZh: "海淀",
    addressZh: "北京市海淀区宫门前街 1 号",
    starRating: 5,
    roomTypeCode: "COURTYARD-KING",
    roomNameZh: "庭院大床房",
    ratePlanId: "RP-BJS-AMAN-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 3200,
    cancellationPolicyZh: "北京时间 2026-06-07 18:00 前可免费取消。",
    metadata: "DIDA_META_BJS_AMAN_20260611_20260615_RP_BB",
    sellingPointsZh: ["近颐和园", "庭院度假", "节奏更慢"],
    descriptionZh: "北京颐和安缦靠近颐和园，适合把皇家园林、海淀文化和慢节奏度假放在重点的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "水疗", "庭院", "餐厅", "礼宾服务"],
    nearbyZh: ["颐和园", "圆明园", "北京大学"],
    geo: { latitude: 39.9998, longitude: 116.2749 },
    tags: ["resort", "heritage", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-BJS-10004",
    hotelName: "Rosewood Beijing",
    hotelNameZh: "北京瑰丽酒店",
    destinationCode: "CN-BJS",
    city: "Beijing",
    cityZh: "北京",
    district: "Chaoyang",
    districtZh: "朝阳",
    addressZh: "北京市朝阳区呼家楼京广中心",
    starRating: 5,
    roomTypeCode: "MANOR-KING",
    roomNameZh: "豪华大床房",
    ratePlanId: "RP-BJS-RW-RO",
    boardNameZh: "不含早餐",
    pricePerRoomCny: 1480,
    cancellationPolicyZh: "预订确认后不可取消退款。",
    metadata: "DIDA_META_BJS_RW_20260611_20260615_RP_RO",
    sellingPointsZh: ["国贸 CBD", "商务餐饮方便", "近地铁"],
    descriptionZh: "北京瑰丽酒店位于朝阳 CBD，适合国贸、三里屯和商务会面并重的行程。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "泳池", "餐厅", "商务设施"],
    nearbyZh: ["国贸", "央视大楼", "三里屯"],
    geo: { latitude: 39.9184, longitude: 116.4597 },
    tags: ["business", "metro", "city-view"],
  }),
  hotelFixture({
    hotelId: "DIDA-BJS-10005",
    hotelName: "NUO Hotel Beijing",
    hotelNameZh: "北京诺金酒店",
    destinationCode: "CN-BJS",
    city: "Beijing",
    cityZh: "北京",
    district: "Chaoyang",
    districtZh: "朝阳",
    addressZh: "北京市朝阳区将台路甲 2 号",
    starRating: 5,
    roomTypeCode: "ART-KING",
    roomNameZh: "豪华艺术大床房",
    ratePlanId: "RP-BJS-NUO-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 980,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_BJS_NUO_20260611_20260615_RP_BB",
    sellingPointsZh: ["望京/798 动线", "艺术氛围", "机场方向较顺"],
    descriptionZh: "北京诺金酒店位于将台路，适合把 798 艺术区、望京和机场动线结合的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "室内泳池", "餐厅", "会议设施"],
    nearbyZh: ["798 艺术区", "将台", "望京"],
    geo: { latitude: 39.9722, longitude: 116.4881 },
    tags: ["art", "airport-access", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-SHA-10001",
    hotelName: "Fairmont Peace Hotel",
    hotelNameZh: "上海和平饭店",
    destinationCode: "CN-SHA",
    city: "Shanghai",
    cityZh: "上海",
    district: "Huangpu",
    districtZh: "黄浦",
    addressZh: "上海市黄浦区南京东路 20 号",
    starRating: 5,
    roomTypeCode: "HERITAGE-KING",
    roomNameZh: "经典大床房",
    ratePlanId: "RP-SHA-FPH-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1780,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_SHA_FPH_20260611_20260615_RP_BB",
    sellingPointsZh: ["外滩", "历史建筑", "步行观光方便"],
    descriptionZh: "上海和平饭店位于外滩与南京东路交界，适合第一次到上海并重视城市历史感的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "餐厅", "历史建筑导览", "礼宾服务"],
    nearbyZh: ["外滩", "南京东路", "外白渡桥"],
    geo: { latitude: 31.2394, longitude: 121.4907 },
    tags: ["heritage", "bund", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-SHA-10002",
    hotelName: "The Peninsula Shanghai",
    hotelNameZh: "上海半岛酒店",
    destinationCode: "CN-SHA",
    city: "Shanghai",
    cityZh: "上海",
    district: "Huangpu",
    districtZh: "黄浦",
    addressZh: "上海市黄浦区中山东一路 32 号",
    starRating: 5,
    roomTypeCode: "RIVER-KING",
    roomNameZh: "江景大床房",
    ratePlanId: "RP-SHA-PEN-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 2280,
    cancellationPolicyZh: "北京时间 2026-06-09 18:00 前可免费取消。",
    metadata: "DIDA_META_SHA_PEN_20260611_20260615_RP_BB",
    sellingPointsZh: ["外滩江景", "近苏州河", "适合高端纪念行程"],
    descriptionZh: "上海半岛酒店坐落在外滩北端，适合江景住宿、外滩漫步和浦江游船行程。",
    facilitiesZh: ["免费 Wi-Fi", "室内泳池", "健身房", "餐厅", "水疗"],
    nearbyZh: ["外滩", "苏州河", "南京东路"],
    geo: { latitude: 31.2442, longitude: 121.4909 },
    tags: ["river-view", "bund", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-SHA-10003",
    hotelName: "Mandarin Oriental Pudong Shanghai",
    hotelNameZh: "上海浦东文华东方酒店",
    destinationCode: "CN-SHA",
    city: "Shanghai",
    cityZh: "上海",
    district: "Pudong",
    districtZh: "浦东",
    addressZh: "上海市浦东新区浦东南路 111 号",
    starRating: 5,
    roomTypeCode: "PUDONG-KING",
    roomNameZh: "浦江景观大床房",
    ratePlanId: "RP-SHA-MO-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1680,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_SHA_MO_20260611_20260615_RP_BB",
    sellingPointsZh: ["陆家嘴北滨江", "江景", "商务休闲兼顾"],
    descriptionZh: "上海浦东文华东方酒店位于陆家嘴滨江，适合浦东金融区、滨江散步和亲子休闲。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "室内泳池", "餐厅", "儿童友好"],
    nearbyZh: ["陆家嘴", "东方明珠", "滨江大道"],
    geo: { latitude: 31.2468, longitude: 121.5082 },
    tags: ["river-view", "business", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-SHA-10004",
    hotelName: "The Ritz-Carlton Shanghai, Pudong",
    hotelNameZh: "上海浦东丽思卡尔顿酒店",
    destinationCode: "CN-SHA",
    city: "Shanghai",
    cityZh: "上海",
    district: "Pudong",
    districtZh: "浦东",
    addressZh: "上海市浦东新区世纪大道 8 号上海国金中心",
    starRating: 5,
    roomTypeCode: "SKY-KING",
    roomNameZh: "天际景观大床房",
    ratePlanId: "RP-SHA-RC-RO",
    boardNameZh: "不含早餐",
    pricePerRoomCny: 1980,
    cancellationPolicyZh: "预订确认后不可取消退款。",
    metadata: "DIDA_META_SHA_RC_20260611_20260615_RP_RO",
    sellingPointsZh: ["陆家嘴", "高层景观", "商场连通"],
    descriptionZh: "上海浦东丽思卡尔顿酒店位于陆家嘴国金中心，适合地标观光、购物和高层城市景观。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "餐厅", "酒吧", "商场连通"],
    nearbyZh: ["东方明珠", "上海中心", "正大广场"],
    geo: { latitude: 31.2369, longitude: 121.5017 },
    tags: ["city-view", "shopping", "business"],
  }),
  hotelFixture({
    hotelId: "DIDA-SHA-10005",
    hotelName: "Capella Shanghai Jian Ye Li",
    hotelNameZh: "上海建业里嘉佩乐酒店",
    destinationCode: "CN-SHA",
    city: "Shanghai",
    cityZh: "上海",
    district: "Xuhui",
    districtZh: "徐汇",
    addressZh: "上海市徐汇区建国西路 480 号",
    starRating: 5,
    roomTypeCode: "SHIKUMEN-VILLA",
    roomNameZh: "石库门别墅房",
    ratePlanId: "RP-SHA-CAP-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 2880,
    cancellationPolicyZh: "北京时间 2026-06-08 18:00 前可免费取消。",
    metadata: "DIDA_META_SHA_CAP_20260611_20260615_RP_BB",
    sellingPointsZh: ["衡复风貌区", "石库门体验", "适合慢游"],
    descriptionZh: "上海建业里嘉佩乐酒店位于衡复风貌区，适合把法租界街区、咖啡馆和建筑漫步作为重点的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "水疗", "管家服务", "餐厅", "庭院"],
    nearbyZh: ["武康路", "衡山路", "徐家汇"],
    geo: { latitude: 31.2098, longitude: 121.4458 },
    tags: ["heritage", "slow-travel", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-HGH-10001",
    hotelName: "Four Seasons Hotel Hangzhou at West Lake",
    hotelNameZh: "杭州西子湖四季酒店",
    destinationCode: "CN-HGH",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Xihu",
    districtZh: "西湖",
    addressZh: "杭州市西湖区灵隐路 5 号",
    starRating: 5,
    roomTypeCode: "GARDEN-KING",
    roomNameZh: "园景大床房",
    ratePlanId: "RP-HGH-FS-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 2580,
    cancellationPolicyZh: "北京时间 2026-06-09 18:00 前可免费取消。",
    metadata: "DIDA_META_HGH_FS_20260611_20260615_RP_BB",
    sellingPointsZh: ["近西湖", "园林感", "适合慢游"],
    descriptionZh: "杭州西子湖四季酒店靠近西湖和灵隐方向，适合将湖滨、茶园和寺院慢游结合。",
    facilitiesZh: ["免费 Wi-Fi", "室内泳池", "健身房", "餐厅", "庭院"],
    nearbyZh: ["西湖", "灵隐寺", "曲院风荷"],
    geo: { latitude: 30.2533, longitude: 120.1278 },
    tags: ["lake", "garden", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-HGH-10002",
    hotelName: "Amanfayun",
    hotelNameZh: "杭州法云安缦",
    destinationCode: "CN-HGH",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Xihu",
    districtZh: "西湖",
    addressZh: "杭州市西湖区法云弄 22 号",
    starRating: 5,
    roomTypeCode: "VILLAGE-KING",
    roomNameZh: "村落大床房",
    ratePlanId: "RP-HGH-AMAN-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 3600,
    cancellationPolicyZh: "北京时间 2026-06-07 18:00 前可免费取消。",
    metadata: "DIDA_META_HGH_AMAN_20260611_20260615_RP_BB",
    sellingPointsZh: ["灵隐法云村", "安静度假", "茶园寺院动线"],
    descriptionZh: "杭州法云安缦位于灵隐周边村落，适合重视安静、茶文化和寺院步行体验的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "水疗", "餐厅", "庭院", "礼宾服务"],
    nearbyZh: ["灵隐寺", "飞来峰", "梅家坞"],
    geo: { latitude: 30.2489, longitude: 120.1038 },
    tags: ["resort", "tea", "heritage"],
  }),
  hotelFixture({
    hotelId: "DIDA-HGH-10003",
    hotelName: "Grand Hyatt Hangzhou",
    hotelNameZh: "杭州君悦酒店",
    destinationCode: "CN-HGH",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Shangcheng",
    districtZh: "上城",
    addressZh: "杭州市上城区湖滨路 28 号",
    starRating: 5,
    roomTypeCode: "LAKE-KING",
    roomNameZh: "湖景大床房",
    ratePlanId: "RP-HGH-GH-RO",
    boardNameZh: "不含早餐",
    pricePerRoomCny: 1280,
    cancellationPolicyZh: "预订确认后不可取消退款。",
    metadata: "DIDA_META_HGH_GH_20260611_20260615_RP_RO",
    sellingPointsZh: ["湖滨商圈", "西湖步行", "交通方便"],
    descriptionZh: "杭州君悦酒店位于湖滨商圈，适合第一次到杭州、希望步行到西湖且餐饮购物方便的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "室内泳池", "餐厅", "商圈便利"],
    nearbyZh: ["西湖", "湖滨银泰", "断桥"],
    geo: { latitude: 30.2589, longitude: 120.1585 },
    tags: ["lake", "shopping", "metro"],
  }),
  hotelFixture({
    hotelId: "DIDA-HGH-10004",
    hotelName: "Midtown Shangri-La Hangzhou",
    hotelNameZh: "杭州城中香格里拉",
    destinationCode: "CN-HGH",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Gongshu",
    districtZh: "拱墅",
    addressZh: "杭州市拱墅区长寿路 6 号",
    starRating: 5,
    roomTypeCode: "CITY-TWIN",
    roomNameZh: "豪华城景双床房",
    ratePlanId: "RP-HGH-SL-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 980,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_HGH_SL_20260611_20260615_RP_BB",
    sellingPointsZh: ["武林商圈", "地铁便利", "价格均衡"],
    descriptionZh: "杭州城中香格里拉位于武林商圈，适合把西湖、市中心餐饮和地铁出行结合。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "泳池", "餐厅", "商务设施"],
    nearbyZh: ["武林广场", "杭州大厦", "西湖文化广场"],
    geo: { latitude: 30.2698, longitude: 120.1631 },
    tags: ["value", "shopping", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-HGH-10005",
    hotelName: "Conrad Hangzhou",
    hotelNameZh: "杭州康莱德酒店",
    destinationCode: "CN-HGH",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Shangcheng",
    districtZh: "上城",
    addressZh: "杭州市上城区新业路 228 号来福士中心",
    starRating: 5,
    roomTypeCode: "RIVER-KING",
    roomNameZh: "钱江景观大床房",
    ratePlanId: "RP-HGH-CON-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1180,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_HGH_CON_20260611_20260615_RP_BB",
    sellingPointsZh: ["钱江新城", "高层景观", "商务动线"],
    descriptionZh: "杭州康莱德酒店位于钱江新城，适合商务、钱塘江夜景和城市新中心观光。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "室内泳池", "餐厅", "商务设施"],
    nearbyZh: ["城市阳台", "杭州来福士", "钱塘江"],
    geo: { latitude: 30.2505, longitude: 120.2133 },
    tags: ["business", "river-view", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-HKG-10001",
    hotelName: "The Peninsula Hong Kong",
    hotelNameZh: "香港半岛酒店",
    destinationCode: "HK-HKG",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Tsim Sha Tsui",
    districtZh: "尖沙咀",
    addressZh: "香港九龙尖沙咀梳士巴利道",
    starRating: 5,
    roomTypeCode: "HARBOUR-KING",
    roomNameZh: "海港景观大床房",
    ratePlanId: "RP-HKG-PEN-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 3980,
    cancellationPolicyZh: "北京时间 2026-06-09 18:00 前可免费取消。",
    metadata: "DIDA_META_HKG_PEN_20260611_20260615_RP_BB",
    sellingPointsZh: ["尖沙咀", "维港景观", "经典地标"],
    descriptionZh: "香港半岛酒店位于尖沙咀海旁，适合维港夜景、天星小轮和九龙核心区行程。",
    facilitiesZh: ["免费 Wi-Fi", "室内泳池", "健身房", "餐厅", "水疗"],
    nearbyZh: ["星光大道", "天星码头", "香港文化中心"],
    geo: { latitude: 22.2951, longitude: 114.1719 },
    tags: ["harbour-view", "heritage", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-HKG-10002",
    hotelName: "Mandarin Oriental Hong Kong",
    hotelNameZh: "香港文华东方酒店",
    destinationCode: "HK-HKG",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Central",
    districtZh: "中环",
    addressZh: "香港中环干诺道中 5 号",
    starRating: 5,
    roomTypeCode: "CITY-KING",
    roomNameZh: "城景大床房",
    ratePlanId: "RP-HKG-MO-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 3280,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_HKG_MO_20260611_20260615_RP_BB",
    sellingPointsZh: ["中环核心", "商务餐饮方便", "海港动线"],
    descriptionZh: "香港文华东方酒店位于中环核心，适合商务、上环中环餐饮和港岛城市探索。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "水疗", "餐厅", "礼宾服务"],
    nearbyZh: ["中环码头", "兰桂坊", "太平山缆车"],
    geo: { latitude: 22.2819, longitude: 114.1602 },
    tags: ["business", "metro", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-HKG-10003",
    hotelName: "Four Seasons Hotel Hong Kong",
    hotelNameZh: "香港四季酒店",
    destinationCode: "HK-HKG",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Central",
    districtZh: "中环",
    addressZh: "香港中环金融街 8 号",
    starRating: 5,
    roomTypeCode: "HARBOUR-TWIN",
    roomNameZh: "海港双床房",
    ratePlanId: "RP-HKG-FS-RO",
    boardNameZh: "不含早餐",
    pricePerRoomCny: 3600,
    cancellationPolicyZh: "预订确认后不可取消退款。",
    metadata: "DIDA_META_HKG_FS_20260611_20260615_RP_RO",
    sellingPointsZh: ["中环 IFC", "海景", "购物交通便利"],
    descriptionZh: "香港四季酒店连接中环 IFC，适合港岛商务、购物、机场快线和海港景观住宿。",
    facilitiesZh: ["免费 Wi-Fi", "泳池", "健身房", "餐厅", "商场连通"],
    nearbyZh: ["国际金融中心", "中环码头", "香港摩天轮"],
    geo: { latitude: 22.2861, longitude: 114.1568 },
    tags: ["harbour-view", "shopping", "business"],
  }),
  hotelFixture({
    hotelId: "DIDA-HKG-10004",
    hotelName: "Rosewood Hong Kong",
    hotelNameZh: "香港瑰丽酒店",
    destinationCode: "HK-HKG",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Tsim Sha Tsui",
    districtZh: "尖沙咀",
    addressZh: "香港九龙尖沙咀梳士巴利道 18 号 Victoria Dockside",
    starRating: 5,
    roomTypeCode: "KOWLOON-HARBOUR-KING",
    roomNameZh: "九龙海港大床房",
    ratePlanId: "RP-HKG-RW-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 4200,
    cancellationPolicyZh: "北京时间 2026-06-08 18:00 前可免费取消。",
    metadata: "DIDA_META_HKG_RW_20260611_20260615_RP_BB",
    sellingPointsZh: ["K11 MUSEA", "维港一线", "餐饮选择多"],
    descriptionZh: "香港瑰丽酒店位于 Victoria Dockside，适合维港景观、艺术购物和尖沙咀餐饮行程。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "室外泳池", "餐厅", "水疗"],
    nearbyZh: ["K11 MUSEA", "星光大道", "尖沙咀海滨"],
    geo: { latitude: 22.2942, longitude: 114.1759 },
    tags: ["harbour-view", "shopping", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-HKG-10005",
    hotelName: "The Upper House",
    hotelNameZh: "奕居",
    destinationCode: "HK-HKG",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Admiralty",
    districtZh: "金钟",
    addressZh: "香港金钟道 88 号太古广场",
    starRating: 5,
    roomTypeCode: "STUDIO-KING",
    roomNameZh: "单间大床房",
    ratePlanId: "RP-HKG-UH-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 3100,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_HKG_UH_20260611_20260615_RP_BB",
    sellingPointsZh: ["金钟太古广场", "设计酒店", "港岛交通方便"],
    descriptionZh: "奕居位于金钟太古广场，适合港岛购物、商务和设计感住宿体验。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "餐厅", "商场连通", "礼宾服务"],
    nearbyZh: ["太古广场", "香港公园", "金钟站"],
    geo: { latitude: 22.2775, longitude: 114.1663 },
    tags: ["design", "shopping", "metro"],
  }),
  hotelFixture({
    hotelId: "DIDA-MFM-10001",
    hotelName: "The Venetian Macao",
    hotelNameZh: "澳门威尼斯人",
    destinationCode: "MO-MFM",
    city: "Macau",
    cityZh: "澳门",
    district: "Cotai",
    districtZh: "路氹",
    addressZh: "澳门路氹金光大道",
    starRating: 5,
    roomTypeCode: "BELLA-SUITE",
    roomNameZh: "贝丽套房",
    ratePlanId: "RP-MFM-VEN-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1280,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_MFM_VEN_20260611_20260615_RP_BB",
    sellingPointsZh: ["路氹金光大道", "套房空间大", "购物餐饮集中"],
    descriptionZh: "澳门威尼斯人位于路氹金光大道，适合购物、娱乐和家庭游客的一站式行程。",
    facilitiesZh: ["免费 Wi-Fi", "泳池", "购物中心", "餐厅", "接驳服务"],
    nearbyZh: ["威尼斯人购物中心", "伦敦人", "巴黎人"],
    geo: { latitude: 22.1486, longitude: 113.5628 },
    tags: ["shopping", "family", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-MFM-10002",
    hotelName: "Grand Lisboa Palace Macau",
    hotelNameZh: "澳门上葡京综合度假村",
    destinationCode: "MO-MFM",
    city: "Macau",
    cityZh: "澳门",
    district: "Cotai",
    districtZh: "路氹",
    addressZh: "澳门路氹射击路",
    starRating: 5,
    roomTypeCode: "PALACE-KING",
    roomNameZh: "皇宫大床房",
    ratePlanId: "RP-MFM-GLP-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1180,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_MFM_GLP_20260611_20260615_RP_BB",
    sellingPointsZh: ["路氹度假区", "综合度假", "亲子与餐饮选择"],
    descriptionZh: "澳门上葡京综合度假村位于路氹，适合综合度假、餐饮和轻松休闲行程。",
    facilitiesZh: ["免费 Wi-Fi", "泳池", "健身房", "餐厅", "接驳服务"],
    nearbyZh: ["路氹金光大道", "澳门东亚运动会体育馆", "官也街"],
    geo: { latitude: 22.1416, longitude: 113.5682 },
    tags: ["resort", "family", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-MFM-10003",
    hotelName: "Mandarin Oriental Macau",
    hotelNameZh: "澳门文华东方酒店",
    destinationCode: "MO-MFM",
    city: "Macau",
    cityZh: "澳门",
    district: "Macau Peninsula",
    districtZh: "澳门半岛",
    addressZh: "澳门外港新填海区孙逸仙大马路",
    starRating: 5,
    roomTypeCode: "BAY-KING",
    roomNameZh: "湾景大床房",
    ratePlanId: "RP-MFM-MO-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1880,
    cancellationPolicyZh: "北京时间 2026-06-09 18:00 前可免费取消。",
    metadata: "DIDA_META_MFM_MO_20260611_20260615_RP_BB",
    sellingPointsZh: ["南湾湖", "半岛动线", "安静高端"],
    descriptionZh: "澳门文华东方酒店位于南湾湖畔，适合澳门半岛历史街区、海滨和高端餐饮行程。",
    facilitiesZh: ["免费 Wi-Fi", "健身房", "水疗", "餐厅", "海湾景观"],
    nearbyZh: ["澳门旅游塔", "南湾湖", "议事亭前地"],
    geo: { latitude: 22.1855, longitude: 113.5479 },
    tags: ["bay-view", "heritage", "breakfast"],
  }),
  hotelFixture({
    hotelId: "DIDA-MFM-10004",
    hotelName: "Wynn Palace",
    hotelNameZh: "永利皇宫",
    destinationCode: "MO-MFM",
    city: "Macau",
    cityZh: "澳门",
    district: "Cotai",
    districtZh: "路氹",
    addressZh: "澳门路氹体育馆大马路",
    starRating: 5,
    roomTypeCode: "FOUNTAIN-KING",
    roomNameZh: "喷泉景观大床房",
    ratePlanId: "RP-MFM-WP-RO",
    boardNameZh: "不含早餐",
    pricePerRoomCny: 1680,
    cancellationPolicyZh: "预订确认后不可取消退款。",
    metadata: "DIDA_META_MFM_WP_20260611_20260615_RP_RO",
    sellingPointsZh: ["表演湖景", "路氹核心", "餐饮购物方便"],
    descriptionZh: "永利皇宫位于路氹核心区，适合偏好度假村设施、购物和夜间景观的旅客。",
    facilitiesZh: ["免费 Wi-Fi", "泳池", "健身房", "餐厅", "缆车景观"],
    nearbyZh: ["永利皇宫表演湖", "澳门伦敦人", "官也街"],
    geo: { latitude: 22.1445, longitude: 113.5696 },
    tags: ["resort", "shopping", "view"],
  }),
  hotelFixture({
    hotelId: "DIDA-MFM-10005",
    hotelName: "Galaxy Hotel Macau",
    hotelNameZh: "澳门银河酒店",
    destinationCode: "MO-MFM",
    city: "Macau",
    cityZh: "澳门",
    district: "Cotai",
    districtZh: "路氹",
    addressZh: "澳门路氹城澳门银河综合度假城",
    starRating: 5,
    roomTypeCode: "RESORT-TWIN",
    roomNameZh: "度假双床房",
    ratePlanId: "RP-MFM-GAL-BB",
    boardNameZh: "含早餐",
    pricePerRoomCny: 1380,
    cancellationPolicyZh: "北京时间 2026-06-10 18:00 前可免费取消。",
    metadata: "DIDA_META_MFM_GAL_20260611_20260615_RP_BB",
    sellingPointsZh: ["综合度假城", "亲子设施", "餐饮集中"],
    descriptionZh: "澳门银河酒店位于路氹综合度假城，适合亲子、水上设施和多餐饮选择的行程。",
    facilitiesZh: ["免费 Wi-Fi", "泳池", "儿童友好", "餐厅", "接驳服务"],
    nearbyZh: ["澳门银河天浪淘园", "官也街", "路氹金光大道"],
    geo: { latitude: 22.1488, longitude: 113.5529 },
    tags: ["family", "resort", "breakfast"],
  }),
] as const;

function attractionFixture(input: {
  attractionId: string;
  name: string;
  attractionNameZh: string;
  city: string;
  cityZh: string;
  district: string;
  districtZh: string;
  ticketTypeZh: string;
  priceCny: number;
  recommendedDay: number;
  highlightsZh: string[];
}) {
  return {
    ...input,
    ticketType: input.ticketTypeZh,
  };
}

const attractions = [
  attractionFixture({
    attractionId: "SZX-TICKET-WINDOW-WORLD",
    name: "Window of the World",
    attractionNameZh: "世界之窗",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Nanshan",
    districtZh: "南山",
    ticketTypeZh: "成人日场票",
    priceCny: 220,
    recommendedDay: 2,
    highlightsZh: ["世界地标微缩景观", "夜场演出", "适合首次到深圳"],
  }),
  attractionFixture({
    attractionId: "SZX-TICKET-SPLENDID-CHINA",
    name: "Splendid China Folk Village",
    attractionNameZh: "锦绣中华民俗村",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Nanshan",
    districtZh: "南山",
    ticketTypeZh: "成人日场票",
    priceCny: 198,
    recommendedDay: 3,
    highlightsZh: ["民俗表演", "中国地标微缩", "亲子友好"],
  }),
  attractionFixture({
    attractionId: "SZX-TICKET-PINGAN-FC",
    name: "Ping An Finance Center Free Sky",
    attractionNameZh: "平安金融中心云际观光层",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Futian",
    districtZh: "福田",
    ticketTypeZh: "观光层门票",
    priceCny: 180,
    recommendedDay: 4,
    highlightsZh: ["城市高空观景", "近福田 CBD", "适合夜景"],
  }),
  attractionFixture({
    attractionId: "SZX-TICKET-BAY-PARK",
    name: "Shenzhen Bay Park",
    attractionNameZh: "深圳湾公园",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Nanshan",
    districtZh: "南山",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 1,
    highlightsZh: ["海滨步道", "日落", "轻松抵达"],
  }),
  attractionFixture({
    attractionId: "SZX-TICKET-DAMEISHA",
    name: "Dameisha Beach Park",
    attractionNameZh: "大梅沙海滨公园",
    city: "Shenzhen",
    cityZh: "深圳",
    district: "Yantian",
    districtZh: "盐田",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 5,
    highlightsZh: ["海滨休闲", "亲子友好", "度假感"],
  }),
  attractionFixture({
    attractionId: "CAN-TICKET-CANTON-TOWER",
    name: "Canton Tower",
    attractionNameZh: "广州塔",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Haizhu",
    districtZh: "海珠",
    ticketTypeZh: "观光层门票",
    priceCny: 150,
    recommendedDay: 1,
    highlightsZh: ["城市地标", "珠江夜景", "近有轨电车"],
  }),
  attractionFixture({
    attractionId: "CAN-TICKET-CHEN-CLAN",
    name: "Chen Clan Ancestral Hall",
    attractionNameZh: "陈家祠",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Liwan",
    districtZh: "荔湾",
    ticketTypeZh: "成人门票",
    priceCny: 10,
    recommendedDay: 2,
    highlightsZh: ["岭南建筑", "木雕石雕", "西关文化"],
  }),
  attractionFixture({
    attractionId: "CAN-TICKET-SHAMIAN",
    name: "Shamian Island",
    attractionNameZh: "沙面岛",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Liwan",
    districtZh: "荔湾",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 2,
    highlightsZh: ["历史街区", "欧陆建筑", "适合步行"],
  }),
  attractionFixture({
    attractionId: "CAN-TICKET-BAIYUN",
    name: "Baiyun Mountain",
    attractionNameZh: "白云山",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Baiyun",
    districtZh: "白云",
    ticketTypeZh: "成人门票",
    priceCny: 5,
    recommendedDay: 3,
    highlightsZh: ["城市山景", "轻徒步", "空气清新"],
  }),
  attractionFixture({
    attractionId: "CAN-TICKET-CHIMELONG",
    name: "Chimelong Safari Park",
    attractionNameZh: "长隆野生动物世界",
    city: "Guangzhou",
    cityZh: "广州",
    district: "Panyu",
    districtZh: "番禺",
    ticketTypeZh: "成人日场票",
    priceCny: 300,
    recommendedDay: 4,
    highlightsZh: ["动物园", "亲子全天行程", "园区接驳"],
  }),
  attractionFixture({
    attractionId: "BJS-TICKET-PALACE-MUSEUM",
    name: "The Palace Museum",
    attractionNameZh: "故宫博物院",
    city: "Beijing",
    cityZh: "北京",
    district: "Dongcheng",
    districtZh: "东城",
    ticketTypeZh: "成人门票",
    priceCny: 60,
    recommendedDay: 1,
    highlightsZh: ["明清皇宫", "需提前预约", "历史文化重点"],
  }),
  attractionFixture({
    attractionId: "BJS-TICKET-TEMPLE-HEAVEN",
    name: "Temple of Heaven Park",
    attractionNameZh: "天坛公园",
    city: "Beijing",
    cityZh: "北京",
    district: "Dongcheng",
    districtZh: "东城",
    ticketTypeZh: "联票",
    priceCny: 34,
    recommendedDay: 2,
    highlightsZh: ["祈年殿", "皇家祭祀建筑", "适合上午游览"],
  }),
  attractionFixture({
    attractionId: "BJS-TICKET-SUMMER-PALACE",
    name: "Summer Palace",
    attractionNameZh: "颐和园",
    city: "Beijing",
    cityZh: "北京",
    district: "Haidian",
    districtZh: "海淀",
    ticketTypeZh: "成人门票",
    priceCny: 30,
    recommendedDay: 3,
    highlightsZh: ["皇家园林", "昆明湖", "适合半日慢游"],
  }),
  attractionFixture({
    attractionId: "BJS-TICKET-BADALING",
    name: "Badaling Great Wall",
    attractionNameZh: "八达岭长城",
    city: "Beijing",
    cityZh: "北京",
    district: "Yanqing",
    districtZh: "延庆",
    ticketTypeZh: "成人门票",
    priceCny: 40,
    recommendedDay: 4,
    highlightsZh: ["长城经典段", "需预留交通时间", "适合全天安排"],
  }),
  attractionFixture({
    attractionId: "BJS-TICKET-LAMA-TEMPLE",
    name: "Lama Temple",
    attractionNameZh: "雍和宫",
    city: "Beijing",
    cityZh: "北京",
    district: "Dongcheng",
    districtZh: "东城",
    ticketTypeZh: "成人门票",
    priceCny: 25,
    recommendedDay: 5,
    highlightsZh: ["藏传佛教寺院", "近国子监", "胡同动线顺"],
  }),
  attractionFixture({
    attractionId: "SHA-TICKET-BUND",
    name: "The Bund",
    attractionNameZh: "外滩",
    city: "Shanghai",
    cityZh: "上海",
    district: "Huangpu",
    districtZh: "黄浦",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 1,
    highlightsZh: ["浦江夜景", "万国建筑群", "首次到上海必看"],
  }),
  attractionFixture({
    attractionId: "SHA-TICKET-YU-GARDEN",
    name: "Yu Garden",
    attractionNameZh: "豫园",
    city: "Shanghai",
    cityZh: "上海",
    district: "Huangpu",
    districtZh: "黄浦",
    ticketTypeZh: "成人门票",
    priceCny: 40,
    recommendedDay: 2,
    highlightsZh: ["江南园林", "城隍庙商圈", "传统点心"],
  }),
  attractionFixture({
    attractionId: "SHA-TICKET-ORIENTAL-PEARL",
    name: "Oriental Pearl Tower",
    attractionNameZh: "东方明珠广播电视塔",
    city: "Shanghai",
    cityZh: "上海",
    district: "Pudong",
    districtZh: "浦东",
    ticketTypeZh: "观光层门票",
    priceCny: 199,
    recommendedDay: 2,
    highlightsZh: ["陆家嘴地标", "城市高空观景", "亲子友好"],
  }),
  attractionFixture({
    attractionId: "SHA-TICKET-MUSEUM",
    name: "Shanghai Museum",
    attractionNameZh: "上海博物馆",
    city: "Shanghai",
    cityZh: "上海",
    district: "Huangpu",
    districtZh: "黄浦",
    ticketTypeZh: "预约免费",
    priceCny: 0,
    recommendedDay: 3,
    highlightsZh: ["青铜器", "书画", "人民广场动线"],
  }),
  attractionFixture({
    attractionId: "SHA-TICKET-DISNEY",
    name: "Shanghai Disney Resort",
    attractionNameZh: "上海迪士尼度假区",
    city: "Shanghai",
    cityZh: "上海",
    district: "Pudong",
    districtZh: "浦东",
    ticketTypeZh: "一日票",
    priceCny: 475,
    recommendedDay: 4,
    highlightsZh: ["主题乐园", "全天行程", "亲子和情侣适合"],
  }),
  attractionFixture({
    attractionId: "HGH-TICKET-WEST-LAKE",
    name: "West Lake",
    attractionNameZh: "西湖",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Xihu",
    districtZh: "西湖",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 1,
    highlightsZh: ["湖滨漫步", "断桥", "四季皆宜"],
  }),
  attractionFixture({
    attractionId: "HGH-TICKET-LINGYIN",
    name: "Lingyin Temple",
    attractionNameZh: "灵隐寺",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Xihu",
    districtZh: "西湖",
    ticketTypeZh: "成人门票",
    priceCny: 75,
    recommendedDay: 2,
    highlightsZh: ["古寺", "飞来峰造像", "早上更舒适"],
  }),
  attractionFixture({
    attractionId: "HGH-TICKET-XIXI",
    name: "Xixi National Wetland Park",
    attractionNameZh: "西溪国家湿地公园",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Xihu",
    districtZh: "西湖",
    ticketTypeZh: "成人门票",
    priceCny: 80,
    recommendedDay: 3,
    highlightsZh: ["湿地游船", "自然休闲", "半日到一日"],
  }),
  attractionFixture({
    attractionId: "HGH-TICKET-LEIFENG",
    name: "Leifeng Pagoda",
    attractionNameZh: "雷峰塔",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Xihu",
    districtZh: "西湖",
    ticketTypeZh: "成人门票",
    priceCny: 40,
    recommendedDay: 4,
    highlightsZh: ["西湖俯瞰", "白蛇传文化", "日落时段"],
  }),
  attractionFixture({
    attractionId: "HGH-TICKET-TEA-MUSEUM",
    name: "China National Tea Museum",
    attractionNameZh: "中国茶叶博物馆",
    city: "Hangzhou",
    cityZh: "杭州",
    district: "Xihu",
    districtZh: "西湖",
    ticketTypeZh: "预约免费",
    priceCny: 0,
    recommendedDay: 5,
    highlightsZh: ["龙井茶文化", "茶园", "适合慢游"],
  }),
  attractionFixture({
    attractionId: "HKG-TICKET-PEAK",
    name: "Victoria Peak",
    attractionNameZh: "太平山顶",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Central and Western",
    districtZh: "中西区",
    ticketTypeZh: "山顶缆车套票",
    priceCny: 108,
    recommendedDay: 1,
    highlightsZh: ["维港夜景", "山顶缆车", "经典地标"],
  }),
  attractionFixture({
    attractionId: "HKG-TICKET-STAR-FERRY",
    name: "Star Ferry",
    attractionNameZh: "天星小轮",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Tsim Sha Tsui",
    districtZh: "尖沙咀",
    ticketTypeZh: "单程船票",
    priceCny: 5,
    recommendedDay: 1,
    highlightsZh: ["维港横渡", "低成本体验", "日落时段好看"],
  }),
  attractionFixture({
    attractionId: "HKG-TICKET-DISNEY",
    name: "Hong Kong Disneyland",
    attractionNameZh: "香港迪士尼乐园",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Lantau",
    districtZh: "大屿山",
    ticketTypeZh: "一日票",
    priceCny: 620,
    recommendedDay: 2,
    highlightsZh: ["主题乐园", "亲子全天行程", "机场方向顺路"],
  }),
  attractionFixture({
    attractionId: "HKG-TICKET-BIG-BUDDHA",
    name: "Tian Tan Buddha and Ngong Ping 360",
    attractionNameZh: "天坛大佛 / 昂坪 360",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Lantau",
    districtZh: "大屿山",
    ticketTypeZh: "缆车往返票",
    priceCny: 250,
    recommendedDay: 3,
    highlightsZh: ["大屿山景观", "缆车", "文化体验"],
  }),
  attractionFixture({
    attractionId: "HKG-TICKET-AVENUE-STARS",
    name: "Avenue of Stars",
    attractionNameZh: "星光大道",
    city: "Hong Kong",
    cityZh: "香港",
    district: "Tsim Sha Tsui",
    districtZh: "尖沙咀",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 4,
    highlightsZh: ["维港步道", "夜景", "尖沙咀动线"],
  }),
  attractionFixture({
    attractionId: "MFM-TICKET-RUINS-ST-PAUL",
    name: "Ruins of St. Paul's",
    attractionNameZh: "大三巴牌坊",
    city: "Macau",
    cityZh: "澳门",
    district: "Macau Peninsula",
    districtZh: "澳门半岛",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 1,
    highlightsZh: ["世界遗产", "澳门地标", "步行街区"],
  }),
  attractionFixture({
    attractionId: "MFM-TICKET-SENADO",
    name: "Senado Square",
    attractionNameZh: "议事亭前地",
    city: "Macau",
    cityZh: "澳门",
    district: "Macau Peninsula",
    districtZh: "澳门半岛",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 1,
    highlightsZh: ["葡式铺地", "老城步行", "美食集中"],
  }),
  attractionFixture({
    attractionId: "MFM-TICKET-A-MA",
    name: "A-Ma Temple",
    attractionNameZh: "妈阁庙",
    city: "Macau",
    cityZh: "澳门",
    district: "Macau Peninsula",
    districtZh: "澳门半岛",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 2,
    highlightsZh: ["澳门历史", "庙宇文化", "近海事博物馆"],
  }),
  attractionFixture({
    attractionId: "MFM-TICKET-TOWER",
    name: "Macau Tower",
    attractionNameZh: "澳门旅游塔",
    city: "Macau",
    cityZh: "澳门",
    district: "Macau Peninsula",
    districtZh: "澳门半岛",
    ticketTypeZh: "观光层门票",
    priceCny: 165,
    recommendedDay: 3,
    highlightsZh: ["城市高空观景", "极限项目", "南湾湖景"],
  }),
  attractionFixture({
    attractionId: "MFM-TICKET-VENETIAN",
    name: "The Venetian Macao",
    attractionNameZh: "澳门威尼斯人",
    city: "Macau",
    cityZh: "澳门",
    district: "Cotai",
    districtZh: "路氹",
    ticketTypeZh: "免费开放",
    priceCny: 0,
    recommendedDay: 4,
    highlightsZh: ["室内运河", "购物餐饮", "路氹度假区"],
  }),
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

  getHotelDetails(args: Record<string, unknown>) {
    const input = z
      .object({
        hotelIds: z.array(z.string().min(1)).min(1).max(10),
        language: z.string().default(DISPLAY_LOCALE),
      })
      .parse(args);

    const details = input.hotelIds.map((hotelId) => {
      const hotel = this.findHotelById(hotelId);
      return {
        source: "demo-fixture",
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
        geo: hotel.geo,
        descriptionZh: hotel.descriptionZh,
        facilitiesZh: hotel.facilitiesZh,
        nearbyZh: hotel.nearbyZh,
        images: hotel.images,
        checkInInstructionsZh: hotel.checkInInstructionsZh,
        rooms: [
          {
            roomTypeCode: hotel.room.roomTypeCode,
            roomName: hotel.room.roomName,
            roomNameZh: hotel.room.roomNameZh,
            ratePlanId: hotel.room.ratePlanId,
            boardName: hotel.room.boardName,
            boardNameZh: hotel.room.boardNameZh,
            pricePerRoomCny: hotel.room.pricePerRoomCny,
            cancellationPolicy: hotel.room.cancellationPolicy,
            cancellationPolicyZh: hotel.room.cancellationPolicyZh,
            metadata: hotel.room.metadata,
          },
        ],
        sellingPointsZh: hotel.sellingPointsZh,
        displaySummaryZh: `${hotel.hotelNameZh}，${hotel.districtZh}，${hotel.starRating} 星，${hotel.descriptionZh} 主要设施：${hotel.facilitiesZh.join("、")}。`,
      };
    });

    return {
      source: "demo-fixture",
      locale: DISPLAY_LOCALE,
      didaEndpoint: ENDPOINT.hotelDetails,
      didaDocs: [SOURCE.content],
      requestModel: {
        hotelIds: input.hotelIds,
        language: input.language,
      },
      hotels: details,
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
      options: [
        {
          transferId: `DEMO-TRANSFER-${stableCode(input.pickup)}-${stableCode(input.dropoff)}-7`,
          name: `${input.pickup} to ${input.dropoff}`,
          transferNameZh: `${input.pickup}至${input.dropoff}专车`,
          vehicleClass: "Business 7-seater",
          vehicleClassZh: "商务 7 座车",
          maxPassengers: 6,
          priceCny: 388,
          includes: ["Meet-and-greet", "90 minutes free waiting", "Flight delay monitoring"],
          includesZh: ["举牌接机", "免费等候 90 分钟", "航班延误监测"],
        },
        {
          transferId: `DEMO-TRANSFER-${stableCode(input.pickup)}-${stableCode(input.dropoff)}-5`,
          name: `${input.pickup} to ${input.dropoff}`,
          transferNameZh: `${input.pickup}至${input.dropoff}舒适专车`,
          vehicleClass: "Comfort 5-seater",
          vehicleClassZh: "舒适 5 座车",
          maxPassengers: 3,
          priceCny: 268,
          includes: ["Airport pickup", "60 minutes free waiting"],
          includesZh: ["机场接机", "免费等候 60 分钟"],
        },
      ]
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
    const city = normalizeCity(input.city);
    const filtered = attractions.filter((attraction) => normalizeCity(attraction.city) === city);
    return {
      source: "demo-fixture",
      locale: DISPLAY_LOCALE,
      didaEndpoint: "Dida attraction API not in Milestone 1 official docs; local fixture only",
      query: input,
      options: filtered.map((attraction) => ({
        ...attraction,
        locale: DISPLAY_LOCALE,
        estimatedTotalCny: attraction.priceCny * input.travelers,
        displaySummaryZh: `${attraction.attractionNameZh}，${attraction.cityZh}${attraction.districtZh}，${attraction.ticketTypeZh}，建议第 ${attraction.recommendedDay} 天安排，${input.travelers} 人预计 CNY ${attraction.priceCny * input.travelers}。亮点：${attraction.highlightsZh.join("、")}。`,
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

  private findHotelById(hotelId: string) {
    const hotel = hotels.find((candidate) => candidate.hotelId === hotelId);
    if (!hotel) {
      throw new DidaTravelDemoError("No demo hotel matches the supplied hotelId.", "hotel_not_found");
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
      title: "Search destination-city hotels",
      description:
        "Fixture simulation of Dida PriceSearch for selected destination cities. Returns hotel/rate candidates and the Metadata that PriceConfirm must reuse unchanged.",
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
      name: "dida_demo_get_hotel_details",
      title: "Get hotel details",
      description:
        "Fixture simulation of Dida Content API /api/v1/hotel/details. Returns static hotel detail content for a specific list of hotel IDs.",
      inputShape: {
        hotelIds: z.array(z.string().min(1)).min(1).max(10),
        language: z.string().default(DISPLAY_LOCALE),
      },
      endpoint: ENDPOINT.hotelDetails,
      source: SOURCE.content,
      readOnly: true,
      destructive: false,
      handler: (client, args) => client.getHotelDetails(args),
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
        "Local fixture search for airport-to-hotel transfer options used by the Phase 1 itinerary demo.",
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
      title: "Search destination-city attractions",
      description:
        "Local fixture search for attraction tickets in supported destination cities used by the Phase 1 itinerary demo.",
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
  if (["深圳", "深圳市", "shenzhen", "szx"].includes(trimmed)) return "shenzhen";
  if (["广州", "广州市", "guangzhou", "canton", "can"].includes(trimmed)) return "guangzhou";
  if (["北京", "北京市", "beijing", "peking", "bjs", "pek", "pkx"].includes(trimmed)) return "beijing";
  if (["上海", "上海市", "shanghai", "sha", "pvg", "sha airport"].includes(trimmed)) return "shanghai";
  if (["杭州", "杭州市", "hangzhou", "hgh"].includes(trimmed)) return "hangzhou";
  if (["香港", "香港特别行政区", "hong kong", "hongkong", "hkg"].includes(trimmed)) return "hong kong";
  if (["澳门", "澳门特别行政区", "macau", "macao", "mfm"].includes(trimmed)) return "macau";
  return trimmed;
}

function stableCode(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\dA-Za-z\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .toUpperCase();
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
