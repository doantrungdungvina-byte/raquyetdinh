import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

const COLUMNS = [
  "close", "change", "Perf.W", "Perf.1M", "volume", "average_volume_10d_calc",
  "RSI", "EMA9", "EMA21", "EMA50", "EMA200", "MACD.macd", "MACD.signal",
  "BB.upper", "BB.lower", "ATR", "price_52_week_high", "price_52_week_low", "description",
  "RSI|1W", "EMA9|1W", "EMA21|1W", "EMA50|1W", "EMA200|1W", "MACD.macd|1W", "MACD.signal|1W", "Perf.1M|1W"
];
const num = v => v == null || !Number.isFinite(Number(v)) ? null : Number(v);
const round = (v, d = 2) => v == null ? null : Number(v.toFixed(d));

function scenario(v) {
  let up = 0, down = 0, side = 0;
  const valid = (...xs) => xs.every(x => x != null);
  if (valid(v.ema9, v.ema21, v.ema50, v.ema200)) {
    if (v.ema9 > v.ema21 && v.ema21 > v.ema50 && v.ema50 > v.ema200) up += 34;
    else if (v.ema9 < v.ema21 && v.ema21 < v.ema50 && v.ema50 < v.ema200) down += 34;
    else side += 18;
  } else side += 10;
  if (v.rsi != null) {
    if (v.rsi >= 55 && v.rsi <= 68) up += 22;
    else if (v.rsi > 72) { up += 8; side += 10; }
    else if (v.rsi <= 32) { down += 8; side += 10; }
    else if (v.rsi < 45) down += 18;
    else side += 15;
  }
  if (valid(v.macd, v.macdSignal)) {
    if (v.macd > v.macdSignal) up += 20;
    else if (v.macd < v.macdSignal) down += 20;
    else side += 10;
  }
  const total = up + down + side || 1;
  const vals = [{ name: "UP", value: up / total * 100 }, { name: "DOWN", value: down / total * 100 }, { name: "SIDEWAY", value: side / total * 100 }];
  vals.sort((a, b) => b.value - a.value);
  return { up: round(up / total * 100, 1), down: round(down / total * 100, 1), sideways: round(side / total * 100, 1), primary: vals[0].name, note: "Ước tính kỹ thuật từ EMA/RSI/MACD; không phải xác suất thống kê." };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "IDC").trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
  const requestedExchange = (searchParams.get("exchange") || "HNX").trim().toUpperCase();
  if (!/^[A-Z0-9.]{2,12}$/.test(symbol)) return NextResponse.json({ error: "Mã cổ phiếu không hợp lệ." }, { status: 400 });
  const exchanges = [requestedExchange, ...["HNX", "HOSE", "UPCOM"].filter(x => x !== requestedExchange)];
  let lastError = "Không tìm thấy mã trên TradingView.";
  for (const exchange of exchanges) {
    try {
      const response = await fetch("https://scanner.tradingview.com/vietnam/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ symbols: { tickers: [`${exchange}:${symbol}`], query: { types: [] } }, columns: COLUMNS }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) { lastError = `TradingView HTTP ${response.status} khi truy vấn ${exchange}:${symbol}`; continue; }
      const payload = await response.json();
      const row = payload?.data?.[0];
      if (!row?.d || num(row.d[0]) == null) { lastError = `TradingView không trả dữ liệu cho ${exchange}:${symbol}`; continue; }
      const d = row.d;
      const daily = { rsi:num(d[6]), ema9:num(d[7]), ema21:num(d[8]), ema50:num(d[9]), ema200:num(d[10]), macd:num(d[11]), macdSignal:num(d[12]) };
      const weekly = { rsi:num(d[19]), ema9:num(d[20]), ema21:num(d[21]), ema50:num(d[22]), ema200:num(d[23]), macd:num(d[24]), macdSignal:num(d[25]) };
      const volume = num(d[4]);
      const avgVolume10 = num(d[5]);
      const dailyScenario = scenario(daily);
      const weeklyScenario = scenario(weekly);
      let score = 50;
      if (dailyScenario.primary === "UP") score += 18; else if (dailyScenario.primary === "DOWN") score -= 18;
      if (weeklyScenario.primary === "UP") score += 20; else if (weeklyScenario.primary === "DOWN") score -= 20;
      if (daily.rsi != null && daily.rsi > 70) score -= 5;
      if (daily.rsi != null && daily.rsi < 30) score += 5;
      score = Math.max(0, Math.min(100, Math.round(score)));
      const action = score >= 70 ? "BUY" : score <= 35 ? "SELL" : "HOLD";
      const item = {
        symbol, exchange, ticker: row.s || `${exchange}:${symbol}`, name: d[18] || symbol,
        price: num(d[0]), changePct: num(d[1]), perfWeek: num(d[2]), perfMonth: num(d[3]),
        volume: volume == null ? null : Math.round(volume), avgVolume10: avgVolume10 == null ? null : Math.round(avgVolume10),
        volumeRatio: volume != null && avgVolume10 > 0 ? round(volume / avgVolume10, 2) : null,
        technicalScore: score, action, dailyScenario, weeklyScenario,
        ema9:daily.ema9, ema21:daily.ema21, ema50:daily.ema50, ema200:daily.ema200,
        rsi:daily.rsi, macd:daily.macd, macdSignal:daily.macdSignal, bbUpper:num(d[13]), bbLower:num(d[14]), atr:num(d[15]),
        high52:num(d[16]), low52:num(d[17]),
        support:num(d[14]), resistance:num(d[13]),
        weeklyRsi:weekly.rsi, updatedAt:new Date().toISOString(), source:"TradingView Scanner",
        note:"Điểm và kịch bản là ước tính kỹ thuật, không phải xác suất thống kê hoặc khuyến nghị đầu tư."
      };
      return NextResponse.json({ item }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } });
    } catch (error) { lastError = error?.message || String(error); }
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}
