import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const num = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || value === "") return null;
  let raw = String(value).replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  const comma = raw.lastIndexOf(","), dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = raw.length - comma - 1;
    raw = decimals > 0 && decimals <= 2 ? raw.replace(",", ".") : raw.replace(/,/g, "");
  } else if ((raw.match(/\./g) || []).length > 1) {
    const last = raw.lastIndexOf(".");
    raw = raw.slice(0, last).replace(/\./g, "") + raw.slice(last);
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};
const dateText = (value) => {
  if (!value) return null;
  if (typeof value === "number") {
    const d = new Date(value > 1e12 ? value : value * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
};

function pickNav(row) {
  return num(row?.nav ?? row?.lastNav ?? row?.navValue ?? row?.productNavChange?.nav ?? row?.productNavChange?.lastNav ?? row?.productNav?.nav);
}
function pickDate(row) {
  return dateText(row?.navDate ?? row?.lastNavDate ?? row?.updatedAt ?? row?.navUpdatedDate ?? row?.productNavChange?.navDate ?? row?.productNavChange?.updatedAt);
}
function pickHistory(row) {
  const possible = [row?.navHistory, row?.history, row?.navs, row?.productNavHistory, row?.productNavChange?.history];
  const items = possible.find(Array.isArray) || [];
  return items.map((item) => ({
    date: dateText(item?.date ?? item?.navDate ?? item?.createdAt ?? item?.time),
    close: num(item?.nav ?? item?.value ?? item?.navValue ?? item?.close),
  })).filter((item) => item.date && item.close != null && item.close > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-180);
}

async function fetchFmarket(symbol) {
  const response = await fetch("https://api.fmarket.vn/res/products/filter", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "Mozilla/5.0 TradingTools/1.0" },
    body: JSON.stringify({ searchField: symbol, types: ["NEW_FUND", "TRADING_FUND"], pageSize: 20, page: 1 }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Fmarket trả HTTP ${response.status}`);
  const payload = await response.json();
  const rows = payload?.data?.rows || payload?.data?.content || payload?.rows || [];
  // Important: only accept an exact code match; never silently substitute the first search result.
  const row = rows.find((item) => [item?.shortName, item?.code, item?.fundCode, item?.productCode]
    .some((code) => String(code ?? "").trim().toUpperCase() === symbol));
  if (!row) throw new Error(`Fmarket không trả về mã quỹ khớp chính xác ${symbol}`);
  const nav = pickNav(row);
  if (nav == null || nav <= 0) throw new Error(`Fmarket tìm thấy ${symbol} nhưng không có trường NAV hợp lệ`);
  const history = pickHistory(row);
  const pct = num(row?.changePercent ?? row?.navChangePercent ?? row?.productNavChange?.changePercent);
  const prevNav = num(row?.previousNav ?? row?.prevNav ?? row?.productNavChange?.previousNav);
  const changePct = pct ?? (prevNav && prevNav > 0 ? (nav / prevNav - 1) * 100 : (history.length > 1 ? (nav / history.at(-2).close - 1) * 100 : null));
  const changeAbs = prevNav != null ? nav - prevNav : (history.length > 1 ? nav - history.at(-2).close : (changePct != null ? nav - nav / (1 + changePct / 100) : null));
  const performance = {
    oneMonth: num(row?.performance1Month ?? row?.return1M ?? row?.oneMonthReturn),
    threeMonths: num(row?.performance3Months ?? row?.return3M ?? row?.threeMonthReturn),
    sixMonths: num(row?.performance6Months ?? row?.return6M ?? row?.sixMonthReturn),
    oneYear: num(row?.performance1Year ?? row?.return1Y ?? row?.oneYearReturn),
    threeYears: num(row?.performance3Years ?? row?.return3Y ?? row?.threeYearReturn),
  };
  return {
    symbol, name: clean(row?.name ?? row?.fundName ?? row?.shortName ?? symbol), nav,
    changeAbs, changePct, date: pickDate(row), history, performance,
    source: "Fmarket", sourceUrl: "https://fmarket.vn/",
    note: "NAV được đọc từ kết quả Fmarket khớp mã chính xác. API không có tài liệu công khai chính thức; hãy đối chiếu ngày NAV với công ty quản lý quỹ.",
  };
}

async function fetchCafeF(symbol) {
  const url = `https://cafef.vn/du-lieu/chung-chi-quy/${symbol.toLowerCase()}.chn`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TradingTools/1.0)", "Accept-Language": "vi-VN,vi;q=0.9" },
    signal: AbortSignal.timeout(10000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`CafeF trả HTTP ${response.status}`);
  const html = await response.text();
  const text = clean(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&"));
  const pattern = /Giá gần nhất[\s\S]{0,220}?([0-9][0-9.,]*)\s*đ\s*([+\-−]?[0-9]+(?:[.,][0-9]+)?)\s*%/i;
  const match = text.match(pattern);
  if (!match) throw new Error("CafeF không cung cấp cặp NAV và % biến động nhận diện được một cách an toàn");
  const nav = num(match[1].replace(/\./g, "").replace(/,(?=\d{3})/g, ""));
  const changePct = num(match[2].replace(",", ".").replace("−", "-"));
  if (nav == null || nav <= 0 || changePct == null) throw new Error("Dữ liệu CafeF không hợp lệ");
  return {
    symbol, name: symbol, nav, changePct, changeAbs: nav - nav / (1 + changePct / 100),
    date: null, history: [], performance: {}, source: "CafeF", sourceUrl: url,
    note: "CafeF không cung cấp ngày NAV rõ ràng trong dữ liệu đọc được; cần đối chiếu ngày cập nhật trên nguồn chính thức.",
  };
}

export async function GET(_request, { params }) {
  const { symbol: rawSymbol } = await params;
  const symbol = decodeURIComponent(rawSymbol || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{2,15}$/.test(symbol)) {
    return NextResponse.json({ error: "Mã quỹ không hợp lệ." }, { status: 400 });
  }
  const errors = [];
  try {
    const data = await fetchFmarket(symbol);
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } });
  } catch (error) { errors.push(`Fmarket: ${error.message}`); }
  try {
    const data = await fetchCafeF(symbol);
    return NextResponse.json({ ...data, note: `${data.note} Fmarket không dùng được: ${errors[0]}` }, { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } });
  } catch (error) { errors.push(`CafeF: ${error.message}`); }
  return NextResponse.json({
    error: `Không xác minh được NAV cho ${symbol}. ${errors.join("; ")}. Hãy kiểm tra nguồn chính thức của công ty quản lý quỹ.`,
    sourceUrl: "https://fmarket.vn/", cafeFUrl: `https://cafef.vn/du-lieu/chung-chi-quy/${symbol.toLowerCase()}.chn`,
  }, { status: 502 });
}
