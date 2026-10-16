import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_SYMBOL = (process.env.MT5_SYMBOL || "XAUUSDm").toUpperCase();
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function jsonError(message, status = 500) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
function round(n, digits = 4) {
  return Number.isFinite(Number(n)) ? Number(Number(n).toFixed(digits)) : null;
}
function average(values) {
  const good = values.filter(Number.isFinite);
  return good.length ? good.reduce((a, b) => a + b, 0) / good.length : null;
}
function sma(values, period) {
  return values.map((_, i) => i + 1 < period ? null : average(values.slice(i + 1 - period, i + 1)));
}
function rsiSeries(values, period = 14) {
  const out = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}
function makeAnalysis(rows) {
  const closes = rows.map(r => r.close);
  const volumes = rows.map(r => Number.isFinite(r.volume) ? r.volume : 0);
  const rsi = rsiSeries(closes, 14);
  const volMa = sma(volumes, 20);
  const lastIndex = rows.length - 1;
  const last = rows[lastIndex];
  const prev = rows[lastIndex - 1];
  const rsiNow = rsi[lastIndex];
  const rsiPrev = rsi[lastIndex - 1];
  const volumeAvg = volMa[lastIndex];
  const hasVolume = rows.some(r => Number.isFinite(r.volume) && r.volume > 0);
  const rvol = hasVolume && volumeAvg > 0 ? last.volume / volumeAvg : null;
  const range = Math.max(last.high - last.low, 1e-8);
  const body = Math.abs(last.close - last.open);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  const low20 = Math.min(...rows.slice(-20).map(r => r.low));
  const high20 = Math.max(...rows.slice(-20).map(r => r.high));
  const nearLow = last.close <= low20 * 1.025;
  const nearHigh = last.close >= high20 * 0.975;
  const bull = last.close > last.open && last.close >= last.low + range * 0.65;
  const bear = last.close < last.open && last.close <= last.low + range * 0.35;
  const parts = {
    candle: ((lowerWick / range >= 0.35 && lowerWick > body) || (upperWick / range >= 0.35 && upperWick > body)) ? 20 : 0,
    rsi: rsiNow == null ? 0 : (rsiNow < 30 || rsiNow > 70 ? 20 : rsiNow < 40 || rsiNow > 60 ? 12 : 0),
    volume: rvol == null ? 0 : rvol >= 2 ? 20 : rvol >= 1.5 ? 14 : rvol >= 1.2 ? 8 : 0,
    location: nearLow || nearHigh ? 20 : 0,
    confirmation: bull || bear ? 20 : 0,
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  let signal = "Chưa có tín hiệu rõ";
  if (score >= 70 && bull && (nearLow || (rsiNow != null && rsiNow < 40))) signal = "Có dấu hiệu đảo chiều tăng — chờ xác nhận";
  else if (score >= 70 && bear && (nearHigh || (rsiNow != null && rsiNow > 60))) signal = "Có dấu hiệu đảo chiều giảm — chờ xác nhận";
  else if (score >= 50) signal = "Có dấu hiệu cần theo dõi";
  const notes = [];
  if (lowerWick / range >= 0.35 && lowerWick > body) notes.push("Râu nến dưới dài: có thể có lực mua đỡ giá.");
  if (upperWick / range >= 0.35 && upperWick > body) notes.push("Râu nến trên dài: có thể có áp lực bán tại vùng cao.");
  if (nearLow) notes.push("Giá gần đáy thấp nhất 20 nến D1.");
  if (nearHigh) notes.push("Giá gần đỉnh cao nhất 20 nến D1.");
  if (rvol != null && rvol >= 1.5) notes.push(`Tick volume cao hơn trung bình khoảng ${rvol.toFixed(2)} lần; đây là tick volume broker, không phải volume tập trung toàn thị trường.`);
  if (!notes.length) notes.push("Chưa có tổ hợp điều kiện kỹ thuật nổi bật theo ngưỡng hiện tại.");
  return {
    indicators: {
      ma20: round(average(closes.slice(-20))),
      ma50: closes.length >= 50 ? round(average(closes.slice(-50))) : null,
      ma200: closes.length >= 200 ? round(average(closes.slice(-200))) : null,
      rsi14: round(rsiNow), rsiPrevious: round(rsiPrev), rsiChange: round(rsiNow != null && rsiPrev != null ? rsiNow - rsiPrev : null),
      rsiState: rsiNow == null ? "Chưa đủ dữ liệu" : rsiNow < 30 ? "Quá bán" : rsiNow > 70 ? "Quá mua" : rsiNow >= 50 ? "Động lượng nghiêng tăng" : "Động lượng nghiêng giảm",
      divergence: { type: "not_calculated", label: "Chưa tính phân kỳ trên API MT5", detail: "Cần kiểm tra swing trên lịch sử đủ dài trước khi kết luận phân kỳ." },
      volume: hasVolume ? round(last.volume, 0) : null,
      volumeMA20: hasVolume ? round(volumeAvg, 0) : null,
      rvol: rvol == null ? null : round(rvol),
      volumeState: !hasVolume ? "Không có tick volume" : rvol == null ? "Chưa đủ dữ liệu" : rvol >= 2 ? "Tick volume đột biến ≥ 2 lần" : rvol >= 1.5 ? "Tick volume cao hơn bình thường" : "Tick volume bình thường/thấp",
    },
    reversal: {
      score, signal, parts, nearLow, nearHigh,
      candle: { bodyPct: round(body / range * 100), lowerWickPct: round(lowerWick / range * 100), upperWickPct: round(upperWick / range * 100), bullish: bull, bearish: bear },
      notes,
    },
    history: rows.map((r, i) => ({
      date: new Date(r.time * 1000).toISOString().slice(0, 10), open: r.open, high: r.high, low: r.low,
      close: r.close, volume: r.volume, rsi14: round(rsi[i]), volumeMA20: hasVolume ? round(volMa[i], 0) : null,
    })),
    changePct: prev?.close ? round((last.close / prev.close - 1) * 100) : null,
  };
}
async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong Vercel Environment Variables.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export async function POST(request) {
  const expectedKey = process.env.MT5_API_KEY || "";
  if (!expectedKey) return jsonError("Chưa cấu hình MT5_API_KEY trên Vercel.", 503);
  if (request.headers.get("x-api-key") !== expectedKey) return jsonError("API key không hợp lệ.", 401);
  let body;
  try { body = await request.json(); } catch { return jsonError("JSON không hợp lệ.", 400); }
  const symbol = String(body?.symbol || "").toUpperCase();
  if (symbol !== EXPECTED_SYMBOL) return jsonError(`Chỉ chấp nhận symbol ${EXPECTED_SYMBOL}.`, 400);
  if (![body?.bid, body?.ask].every(v => Number.isFinite(Number(v)) && Number(v) > 0) || Number(body.ask) < Number(body.bid)) {
    return jsonError("Bid/Ask không hợp lệ.", 400);
  }
  const bars = body?.timeframes?.D1;
  if (!Array.isArray(bars) || bars.length < 15) return jsonError("Cần gửi tối thiểu 15 nến D1 từ MT5.", 400);
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > 900_000) return jsonError("Payload quá lớn.", 413);
  try {
    const record = { symbol, payload: body, updated_at: new Date().toISOString() };
    await supabaseRequest("mt5_market_latest?on_conflict=symbol", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([record]),
    });
    return NextResponse.json({ ok: true, symbol, updatedAt: record.updated_at }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error.message || "Không lưu được dữ liệu MT5.", 502);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || EXPECTED_SYMBOL).toUpperCase();
  if (symbol !== EXPECTED_SYMBOL) return jsonError(`Chỉ hỗ trợ ${EXPECTED_SYMBOL}.`, 400);
  try {
    const records = await supabaseRequest(`mt5_market_latest?symbol=eq.${encodeURIComponent(symbol)}&select=payload,updated_at&limit=1`);
    const record = records?.[0];
    if (!record?.payload) return jsonError("Chưa nhận được dữ liệu từ MT5 VPS. Hãy chạy EA bridge trên biểu đồ XAUUSDm.", 503);
    const p = record.payload;
    const d1 = p?.timeframes?.D1;
    if (!Array.isArray(d1) || d1.length < 15) return jsonError("MT5 đã gửi nhưng chưa đủ lịch sử D1 để tính chỉ báo.", 503);
    const rows = d1.map(r => ({
      time: Number(r.time), open: Number(r.open), high: Number(r.high), low: Number(r.low), close: Number(r.close),
      volume: Number.isFinite(Number(r.tick_volume)) ? Number(r.tick_volume) : null,
    })).filter(r => Number.isFinite(r.time) && [r.open, r.high, r.low, r.close].every(Number.isFinite)).sort((a, b) => a.time - b.time);
    if (rows.length < 15) return jsonError("Lịch sử D1 từ MT5 không hợp lệ hoặc quá ngắn.", 503);
    const analysis = makeAnalysis(rows);
    const bid = Number(p.bid), ask = Number(p.ask);
    const price = (bid + ask) / 2;
    return NextResponse.json({
      symbol: "XAUUSD", brokerSymbol: symbol, yahooSymbol: `MT5:${symbol}`, currency: "USD",
      bid: round(bid, Number(p.digits ?? 2)), ask: round(ask, Number(p.digits ?? 2)),
      spreadPoints: round(Number(p.spread_points), 1), digits: Number(p.digits ?? 2), price: round(price, Number(p.digits ?? 2)),
      changePct: analysis.changePct, indicators: analysis.indicators, reversal: analysis.reversal, history: analysis.history,
      source: "MT5 broker feed via VPS", sourceNote: "Giá Bid/Ask và nến do broker MT5 cung cấp. Volume là tick volume của broker, không phải khối lượng tập trung toàn thị trường.",
      quoteTimestamp: p.server_time || null, receivedAt: record.updated_at, timeframesAvailable: Object.keys(p.timeframes || {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error.message || "Không đọc được dữ liệu MT5.", 502);
  }
}
