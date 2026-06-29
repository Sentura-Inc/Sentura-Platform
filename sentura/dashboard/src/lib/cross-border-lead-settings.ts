export interface LeadProductOption {
  id: string;
  label: string;
  keyword: string;
  description: string;
}

export interface LeadBuyerTypeOption {
  id: string;
  label: string;
  keyword: string;
  description: string;
}

export interface LeadCountryOption {
  code: string;
  label: string;
  language: string;
  description: string;
}

export interface LeadFilterSettings {
  products: LeadProductOption[];
  buyerTypes: LeadBuyerTypeOption[];
  countries: LeadCountryOption[];
  updatedAt?: string | null;
  updatedByUserId?: string | null;
  source?: "default" | "tenant";
}

export const LEAD_FILTER_PRODUCT_LIMIT = 30;
export const LEAD_FILTER_BUYER_TYPE_LIMIT = 30;
export const LEAD_FILTER_COUNTRY_LIMIT = 60;

export const DEFAULT_LEAD_PRODUCT_OPTIONS: LeadProductOption[] = [
  {
    id: "phone-case",
    label: "手机壳",
    keyword: "手机壳",
    description: "寻找采购手机保护壳、保护套的买家。",
  },
  {
    id: "tempered-glass",
    label: "钢化膜",
    keyword: "钢化膜",
    description: "寻找采购手机屏幕保护膜的买家。",
  },
  {
    id: "usb-c-charger",
    label: "充电器",
    keyword: "充电器",
    description: "寻找采购充电器、数据线等电源配件的买家。",
  },
  {
    id: "magsafe",
    label: "MagSafe 配件",
    keyword: "MagSafe 配件",
    description: "寻找采购磁吸支架、磁吸充电等配件的买家。",
  },
  {
    id: "repair-parts",
    label: "维修配件",
    keyword: "维修配件",
    description: "寻找采购屏幕、排线、电池等维修件的买家。",
  },
];

export const DEFAULT_LEAD_BUYER_TYPE_OPTIONS: LeadBuyerTypeOption[] = [
  {
    id: "repair-chain",
    label: "维修连锁",
    keyword: "维修连锁",
    description: "有线下门店或维修服务网络，通常采购维修件和保护类产品。",
  },
  {
    id: "electronics-retailer",
    label: "电子零售商",
    keyword: "电子零售商",
    description: "销售手机、电子产品或配件的零售公司。",
  },
  {
    id: "accessory-retailer",
    label: "配件零售商",
    keyword: "配件零售商",
    description: "主营手机壳、膜、充电器等配件的零售商。",
  },
  {
    id: "cell-phone-store",
    label: "手机门店",
    keyword: "手机门店",
    description: "本地手机门店或门店型经销商。",
  },
  {
    id: "reseller",
    label: "转售采购商",
    keyword: "转售采购商",
    description: "面向下游渠道转售的采购商。",
  },
  {
    id: "importer",
    label: "进口采购商",
    keyword: "进口采购商",
    description: "有进口或批发采购特征的公司。",
  },
];

export const DEFAULT_LEAD_COUNTRY_OPTIONS: LeadCountryOption[] = [
  { code: "GB", label: "英国", language: "en", description: "优先查公司主体和官网线索。" },
  { code: "US", label: "美国", language: "en", description: "优先查官网、州注册和财务公开线索。" },
  { code: "DE", label: "德国", language: "de", description: "适合电子零售和配件渠道。" },
  { code: "FR", label: "法国", language: "fr", description: "适合法语市场渠道搜索。" },
  { code: "BR", label: "巴西", language: "pt", description: "适合维修配件和本地渠道搜索。" },
  { code: "MX", label: "墨西哥", language: "es", description: "适合拉美零售和维修渠道搜索。" },
];

export const DEFAULT_LEAD_FILTER_SETTINGS: LeadFilterSettings = {
  products: DEFAULT_LEAD_PRODUCT_OPTIONS,
  buyerTypes: DEFAULT_LEAD_BUYER_TYPE_OPTIONS,
  countries: DEFAULT_LEAD_COUNTRY_OPTIONS,
  source: "default",
};
