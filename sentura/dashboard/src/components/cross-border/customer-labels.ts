const buyerTypeDisplayLabels: Record<string, string> = {
  "repair-chain": "维修连锁",
  "repair-store": "维修门店",
  "electronics-retailer": "电子零售商",
  "accessory-retailer": "配件零售商",
  "cell-phone-store": "手机门店",
  reseller: "转售采购商",
  importer: "进口采购商",
  distributor: "分销商",
  wholesaler: "批发商",
  retailer: "零售商",
  "e-commerce-seller": "电商卖家",
  "manual-input": "手动录入",
  "accio-handoff": "来自聊天记录",
  buyer: "采购商",
};

const productDisplayLabels: Record<string, string> = {
  "phone-case": "手机壳",
  "tempered-glass": "钢化膜",
  "screen-protector": "屏幕保护膜",
  "usb-c-charger": "USB-C 充电器",
  charger: "充电器",
  magsafe: "MagSafe 配件",
  "repair-parts": "维修配件",
  cable: "数据线",
  "oled-screen": "OLED 屏幕",
  "mobile-accessories": "手机配件",
  "power-bank": "移动电源",
  earphones: "耳机",
};

function normalizeCustomerLabelValue(value: string) {
  return value.trim().toLowerCase().replace(/[_/]+/g, "-").replace(/\s+/g, "-");
}

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

export function canonicalBuyerType(value: string) {
  const normalized = normalizeCustomerLabelValue(value);
  if (!normalized) return "";
  if (normalized.includes("聊天") || normalized.includes("accio")) return "accio-handoff";
  if (normalized.includes("manual") || normalized.includes("手动")) return "manual-input";
  if (normalized.includes("repair-store") || normalized.includes("维修门店")) return "repair-store";
  if (normalized.includes("repair") || normalized.includes("维修")) return "repair-chain";
  if (normalized.includes("wholesale") || normalized.includes("批发")) return "wholesaler";
  if (normalized.includes("distributor") || normalized.includes("经销") || normalized.includes("分销")) return "distributor";
  if (normalized.includes("importer") || normalized.includes("进口")) return "importer";
  if (normalized.includes("reseller") || normalized.includes("转售")) return "reseller";
  if (normalized.includes("e-commerce") || normalized.includes("ecommerce") || normalized.includes("online-seller") || normalized.includes("电商")) {
    return "e-commerce-seller";
  }
  if (normalized.includes("cell-phone-store") || normalized.includes("phone-store") || normalized.includes("手机门店")) {
    return "cell-phone-store";
  }
  if (normalized.includes("electronics-retailer") || normalized.includes("电子零售")) return "electronics-retailer";
  if (
    normalized.includes("accessory-retailer") ||
    normalized.includes("accessories-retailer") ||
    normalized.includes("accessories-store") ||
    normalized.includes("cell-phone-accessories-retailer") ||
    normalized.includes("mobile-accessories-retailer") ||
    normalized.includes("配件零售")
  ) {
    return "accessory-retailer";
  }
  if (normalized === "retailer" || normalized.includes("retail") || normalized.includes("零售商")) return "retailer";
  if (normalized === "buyer" || normalized.includes("buyer") || normalized.includes("采购")) return "buyer";
  return normalized;
}

export function canonicalProduct(value: string) {
  const normalized = normalizeCustomerLabelValue(value);
  if (!normalized) return "";
  if (normalized.includes("usb-c") || normalized.includes("usb-c-charger")) return "usb-c-charger";
  if (normalized.includes("charger") || normalized.includes("充电器") || normalized.includes("充电")) return "charger";
  if (normalized.includes("oled") || normalized.includes("display") || normalized.includes("screen-module")) return "oled-screen";
  if (normalized.includes("tempered") || normalized.includes("钢化膜")) return "tempered-glass";
  if (normalized.includes("screen-protector") || normalized.includes("保护膜")) return "screen-protector";
  if (normalized.includes("phone-case") || normalized.includes("mobile-phone-case") || normalized.includes("手机壳")) return "phone-case";
  if (
    normalized.includes("repair-parts") ||
    normalized.includes("repair-part") ||
    normalized.includes("spare-parts") ||
    normalized.includes("维修配件")
  ) {
    return "repair-parts";
  }
  if (
    normalized.includes("mobile-accessories") ||
    normalized.includes("cell-phone-accessories") ||
    normalized.includes("phone-accessories") ||
    normalized.includes("手机配件")
  ) {
    return "mobile-accessories";
  }
  if (normalized.includes("power-bank") || normalized.includes("移动电源")) return "power-bank";
  if (normalized.includes("earphone") || normalized.includes("earbud") || normalized.includes("headphone") || normalized.includes("耳机")) return "earphones";
  if (normalized.includes("magsafe")) return "magsafe";
  if (normalized === "cable" || normalized.includes("charging-cable") || normalized.includes("data-cable") || normalized.includes("数据线")) return "cable";
  return normalized;
}

export function buyerTypeLabel(value: string) {
  const canonical = canonicalBuyerType(value);
  if (!canonical) return "客户类型待确认";
  const directLabel = buyerTypeDisplayLabels[canonical];
  if (directLabel) return directLabel;
  return hasChinese(value) ? value : "客户类型待确认";
}

export function productLabel(value: string) {
  const canonical = canonicalProduct(value);
  if (!canonical) return "产品待确认";
  const directLabel = productDisplayLabels[canonical];
  if (directLabel) return directLabel;
  return hasChinese(value) ? value : "产品待确认";
}
