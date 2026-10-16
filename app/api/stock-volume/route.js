import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "FPT").trim().toUpperCase();
  const range = searchParams.get("range") || "3mo";
  const allowedRanges = new Set(["1mo", "3mo", "6mo", "1y"]);
  if (!/^[A-Z0-9]{2,12}$/.test(symbol)) {
    return NextResponse.json({ error: "Mã cổ phiếu không hợp lệ." }, { status: 400 });
  }
  if (!allowedRanges.has(range)) {
    return NextResponse.json({ error: "Khoảng thời gian không hợp lệ." }, { status: 400 });
  }

  const yahooSymbols = [`${symbol}.VN`, `${symbol}.HN`, `${symbol}.UPCOM`, symbol];
  let yahooSymbol = yahooSymbols[0];
  let result = null;
  let lastHttpStatus = null;
  try {
    for (const candidate of yahooSymbols) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?range=${range}&interval=1d&events=history`;
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 TradingTools/1.0", Accept: "application/json" },
          next: { revalidate: 300 },
        });
        lastHttpStatus = response.status;
        if (!response.ok) continue;
        const payload = await response.json();
        const candidateResult = payload?.chart?.result?.[0];
        if (candidateResult?.timestamp?.length && candidateResult?.indicators?.quote?.[0]) {
          yahooSymbol = candidate;
          result = candidateResult;
          break;
        }
      } catch {
        // Continue with the next possible ticker format.
      }
    }
    const quote = result?.indicators?.quote?.[0];
    if (!result?.timestamp?.length || !quote) {
      // Use the same Vnstock fallback as the main stock analysis endpoint.
      try {
        const fallbackUrl = new URL("/api/vnstock", request.url);
        fallbackUrl.searchParams.set("symbol", symbol);
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        const fallback = await fallbackResponse.json().catch(() => null);
        const fallbackHistory = Array.isArray(fallback?.history) ? fallback.history : [];
        const rows = fallbackHistory.map(r => ({
          date: r.date,
          open: Number.isFinite(Number(r.open)) ? Number(r.open) : null,
          high: Number.isFinite(Number(r.high)) ? Number(r.high) : null,
          low: Number.isFinite(Number(r.low)) ? Number(r.low) : null,
          close: Number.isFinite(Number(r.close)) ? Number(r.close) : null,
          volume: Number.isFinite(Number(r.volume)) ? Number(r.volume) : null,
        })).filter(r => r.date && Number.isFinite(r.close) && Number.isFinite(r.volume))
          .sort((a, b) => a.date.localeCompare(b.date));
        if (fallbackResponse.ok && rows.length) {
          const last = rows.at(-1);
          const prev = rows.length > 1 ? rows.at(-2) : null;
          const avgRows = rows.slice(-20);
          const avgVolume20 = avgRows.reduce((sum, r) => sum + r.volume, 0) / avgRows.length;
          const round = n => Number.isFinite(n) ? Number(n.toFixed(2)) : null;
          return NextResponse.json({
            symbol,
            source: fallback.source || "Vnstock",
            yahooSymbol: null,
            updatedAt: fallback.asOf || last.date,
            latest: { ...last, volume: Math.round(last.volume) },
            previous: prev ? { date: prev.date, volume: Math.round(prev.volume) } : null,
            avgVolume20: Math.round(avgVolume20),
            volumeChangePct: prev && prev.volume > 0 ? round((last.volume / prev.volume - 1) * 100) : null,
            volumeVsAvgPct: avgVolume20 > 0 ? round((last.volume / avgVolume20 - 1) * 100) : null,
            history: rows.slice(-180),
          }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } });
        }
      } catch {
        // Keep the original Yahoo error below.
      }
      // Last-resort: get the latest volume snapshot from TradingView Scanner.
      // Scanner provides current/most recent session volume, not historical OHLCV.
      try {
        const exchanges = ["HNX", "HOSE", "UPCOM"];
        const tvResponse = await fetch("https://scanner.tradingview.com/vietnam/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            symbols: { tickers: exchanges.map(ex => `${ex}:${symbol}`), query: { types: [] } },
            columns: ["close", "change", "volume", "average_volume_10d_calc", "name"]
          }),
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
        });
        if (tvResponse.ok) {
          const tvPayload = await tvResponse.json();
          const tvRows = Array.isArray(tvPayload?.data) ? tvPayload.data : [];
          const tvRow = tvRows.find(row => Array.isArray(row?.d)
            && Number.isFinite(Number(row.d[0]))
            && row.d[2] !== null && row.d[2] !== undefined
            && Number.isFinite(Number(row.d[2])));
          if (tvRow) {
            const d = tvRow.d;
            const close = Number(d[0]);
            const changePct = d[1] == null ? null : Number(d[1]);
            const volume = Number(d[2]);
            const avgVolume10 = d[3] == null ? null : Number(d[3]);
            const date = new Date().toISOString().slice(0, 10);
            const round = n => Number.isFinite(n) ? Number(n.toFixed(2)) : null;
            return NextResponse.json({
              symbol,
              source: "TradingView Scanner",
              yahooSymbol: null,
              tradingViewTicker: tvRow.s || null,
              updatedAt: date,
              latest: { date, open: null, high: null, low: null, close, volume: Math.round(volume) },
              previous: null,
              avgVolume20: null,
              avgVolume10: Number.isFinite(avgVolume10) ? Math.round(avgVolume10) : null,
              changePct: round(changePct),
              volumeChangePct: null,
              volumeVsAvgPct: Number.isFinite(avgVolume10) && avgVolume10 > 0 ? round((volume / avgVolume10 - 1) * 100) : null,
              history: [{ date, open: null, high: null, low: null, close, volume: Math.round(volume) }],
              note: "TradingView cung cấp khối lượng phiên gần nhất/ảnh chụp hiện tại; không có lịch sử khối lượng trong nguồn dự phòng này."
            }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } });
          }
        }
      } catch {
        // Keep the diagnostic error below if TradingView also fails.
      }
      throw new Error(`Không lấy được khối lượng cho ${symbol}: Yahoo Finance đã thử ${yahooSymbols.join(", ")}${lastHttpStatus ? ` (HTTP cuối: ${lastHttpStatus})` : ""}; Vnstock và TradingView Scanner cũng không trả khối lượng hợp lệ.`);
    }
    const rows = result.timestamp.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? null,
    })).filter(r => Number.isFinite(r.close) && Number.isFinite(r.volume) && r.volume >= 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!rows.length) throw new Error(`Nguồn không trả khối lượng hợp lệ cho ${symbol}.`);

    const last = rows.at(-1);
    const prev = rows.length > 1 ? rows.at(-2) : null;
    const avg20Rows = rows.slice(-20);
    const avgVolume20 = avg20Rows.reduce((sum, r) => sum + r.volume, 0) / avg20Rows.length;
    const volumeChangePct = prev && prev.volume > 0 ? (last.volume / prev.volume - 1) * 100 : null;
    const volumeVsAvgPct = avgVolume20 > 0 ? (last.volume / avgVolume20 - 1) * 100 : null;
    const round = n => Number.isFinite(n) ? Number(n.toFixed(2)) : null;

    return NextResponse.json({
      symbol,
      source: "Yahoo Finance",
      yahooSymbol,
      updatedAt: last.date,
      latest: { ...last, volume: Math.round(last.volume) },
      previous: prev ? { date: prev.date, volume: Math.round(prev.volume) } : null,
      avgVolume20: Math.round(avgVolume20),
      volumeChangePct: round(volumeChangePct),
      volumeVsAvgPct: round(volumeVsAvgPct),
      history: rows.slice(-180),
    }, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Không thể lấy dữ liệu khối lượng." }, { status: 502 });
  }
}
