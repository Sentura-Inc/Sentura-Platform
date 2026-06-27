function parseHttpUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw)
    ? raw
    : /^[^\s/]+\.[A-Za-z]{2,}(?:\/.*)?$/.test(raw)
      ? `https://${raw}`
      : raw;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function normalizedHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function isPrivateImportYetiApiUrl(url: URL) {
  const host = normalizedHost(url);
  return (
    host === "data.importyeti.com" ||
    host === "api.importyeti.com" ||
    (host.endsWith(".importyeti.com") && /^\/v\d+(?:\.\d+)?\//i.test(url.pathname))
  );
}

function isSecCompanyTickerIndexUrl(url: URL) {
  return normalizedHost(url) === "sec.gov" && url.pathname.replace(/\/+$/, "") === "/files/company_tickers.json";
}

function companiesHousePublicUrl(url: URL) {
  if (normalizedHost(url) !== "api.company-information.service.gov.uk") return null;

  if (url.pathname.replace(/\/+$/, "") === "/search/companies") {
    const publicUrl = new URL("https://find-and-update.company-information.service.gov.uk/search/companies");
    const query = url.searchParams.get("q");
    if (query) publicUrl.searchParams.set("q", query);
    return publicUrl.toString();
  }

  const companyPathMatch = url.pathname.match(/^\/company\/([A-Za-z0-9]+)(\/.*)?$/);
  if (companyPathMatch) {
    const publicUrl = new URL(
      `https://find-and-update.company-information.service.gov.uk/company/${companyPathMatch[1]}${companyPathMatch[2] ?? ""}`,
    );
    url.searchParams.forEach((value, key) => publicUrl.searchParams.set(key, value));
    return publicUrl.toString();
  }

  return null;
}

function secEdgarBrowseUrl(url: URL) {
  if (normalizedHost(url) !== "data.sec.gov") return null;
  const match = url.pathname.match(/^\/submissions\/CIK(\d{1,10})\.json$/i);
  if (!match) return null;
  const cik = match[1].replace(/^0+/, "") || match[1];
  const browseUrl = new URL("https://www.sec.gov/edgar/browse/");
  browseUrl.searchParams.set("CIK", cik);
  browseUrl.searchParams.set("owner", "exclude");
  browseUrl.searchParams.set("action", "getcompany");
  return browseUrl.toString();
}

export function publicReportSourceUrl(value: string | null | undefined) {
  const url = parseHttpUrl(value);
  if (!url) return null;
  if (normalizedHost(url) === "sentura.local") return null;
  if (isPrivateImportYetiApiUrl(url)) return null;
  if (isSecCompanyTickerIndexUrl(url)) return null;
  if (normalizedHost(url) === "api.company-information.service.gov.uk") return companiesHousePublicUrl(url);
  return secEdgarBrowseUrl(url) ?? url.toString();
}
