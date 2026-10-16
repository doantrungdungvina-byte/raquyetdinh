import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

async function yahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(6500) });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const closes = (quote?.close || []).filter((v) => Number.isFinite(v));
  const price = result?.meta?.regularMarketPrice ?? closes.at(-1) ?? null;
  const previous = result?.meta?.chartPreviousClose ?? closes.at(-2) ?? null;
  return { price, changePct: price != null && previous ? ((price - previous) / previous) * 100 : null, currency: result?.meta?.currency || "" };
}

async function getSjc() {
  // Ưu tiên nguồn công khai của SJC; cấu trúc API có thể thay đổi theo thời gian.
  const urls = [
    "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx",
    "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx?method=GetGoldPrice"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json, text/plain, */*" }, cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const body = await res.text();
      const jsonStart = body.indexOf("{");
      if (jsonStart >= 0) {
        const payload = JSON.parse(body.slice(jsonStart));
        const flat = JSON.stringify(payload);
        const match = flat.match(/(?:SJC|Vàng miếng SJC)[^\d]{0,120}(\d{2,3}[,.]?\d{3,6})/i);
        if (match) return { value: Number(match[1].replace(/[,.]/g, "")), source: "SJC", note: "Giá công khai; cần kiểm tra đơn vị mua/bán" };
      }
      const match = body.match(/(?:SJC|Vàng miếng SJC)[^\d]{0,120}(\d{2,3}[,.]?\d{3,6})/i);
      if (match) return { value: Number(match[1].replace(/[,.]/g, "")), source: "SJC", note: "Giá công khai; cần kiểm tra đơn vị mua/bán" };
    } catch {}
  }
  return null;
}

async function getVcbRates() {
  const urls = [
    "https://www.vietcombank.com.vn/KHCN/Cong-cu-tien-ich/Lai-suat",
    "https://www.vietcombank.com.vn/Personal/Utilities/Interest-rate"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, cache: "no-store", signal: AbortSignal.timeout(4500) });
      if (!res.ok) continue;
      const html = (await res.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
      const idx = html.toLowerCase().indexOf("12 tháng");
      if (idx >= 0) {
        const section = html.slice(Math.max(0, idx - 400), idx + 500);
        const rates = [...section.matchAll(/(\d+[,.]?\d*)\s*%/g)].map((m) => Number(m[1].replace(",", "."))).filter((n) => n > 0 && n < 20);
        if (rates.length) return { value: rates[rates.length - 1], term: "12 tháng", source: "Vietcombank" };
      }
      const rates = [...html.matchAll(/(\d+[,.]?\d*)\s*%/g)].map((m) => Number(m[1].replace(",", "."))).filter((n) => n > 0 && n < 20);
      if (rates.length) return { value: rates[0], term: "tham khảo", source: "Vietcombank" };
    } catch {}
  }
  return null;
}

export async function GET() {
  const [gold, usdVnd, vnIndex, vcb] = await Promise.allSettled([
    getSjc(),
    yahooQuote("VND=X"),
    yahooQuote("^VNINDEX"),
    getVcbRates(),
  ]);
  const unwrap = (r) => r.status === "fulfilled" ? r.value : null;
  const usd = unwrap(usdVnd);
  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    goldSjc: unwrap(gold),
    usdVnd: usd ? { value: usd.price, changePct: usd.changePct, source: "Yahoo Finance" } : null,
    vnIndex: unwrap(vnIndex) ? { ...unwrap(vnIndex), source: "Yahoo Finance" } : null,
    vcbRate: unwrap(vcb),
  }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } });
}
