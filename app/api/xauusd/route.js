
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_INTERVALS = new Set([
  "5min", "15min", "30min", "1h", "4h", "1day"
]);

function average(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : null;
}

function sma(values, period) {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    avgGain =
      (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss =
      (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

const round = (value) =>
  Number.isFinite(value) ? Number(value.toFixed(4)) : null;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") || "5min";

  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: "Khung thời gian không hợp lệ." },
      { status: 400 }
    );
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Thiếu TWELVE_DATA_API_KEY. Hãy thêm key trong Vercel → Settings → Environment Variables và deploy lại."
      },
      { status: 503 }
    );
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", "XAU/USD");
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", "250");
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    const payload = await response.json();

    if (
      !response.ok ||
      payload.status === "error" ||
      payload.code ||
      !Array.isArray(payload.values)
    ) {
      const detail =
        payload.message || payload.code || `HTTP ${response.status}`;

      return NextResponse.json(
        { error: `Twelve Data không trả được dữ liệu XAU/USD: ${detail}` },
        { status: 502 }
      );
    }

    const rows = payload.values
      .map((item) => ({
        date: item.datetime,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume:
          item.volume == null ? 0 : Number(item.volume)
      }))
      .filter((row) =>
        [row.open, row.high, row.low, row.close].every(Number.isFinite)
      )
      .reverse();

    if (rows.length < 15) {
      return NextResponse.json(
        { error: "Twelve Data trả về quá ít nến để tính chỉ báo." },
        { status: 502 }
      );
    }

    const closes = rows.map((row) => row.close);
    const last = rows.at(-1);
    const previous = rows.at(-2);

    // ATR (14)
    const trueRanges = rows.map((row, index) => {
      if (index === 0) return row.high - row.low;

      const previousClose = rows[index - 1].close;

      return Math.max(
        row.high - row.low,
        Math.abs(row.high - previousClose),
        Math.abs(row.low - previousClose)
      );
    });

    const atr14 =
      trueRanges.length >= 14
        ? average(trueRanges.slice(-14))
        : null;

    const ma20 = sma(closes, 20);
    const ma50 = sma(closes, 50);
    const ma200 = sma(closes, 200);
    const recent20 = closes.slice(-20);
    const mean20 = average(recent20);
    const std20 = Math.sqrt(average(recent20.map(v => (v - mean20) ** 2)));
    const emaCalc = (values, period) => {
      if (values.length < period) return null;
      const k = 2 / (period + 1);
      let value = average(values.slice(0, period));
      for (let i = period; i < values.length; i++) value = values[i] * k + value * (1 - k);
      return value;
    };
    const ema12 = emaCalc(closes, 12), ema26 = emaCalc(closes, 26);
    const macd = ema12 != null && ema26 != null ? ema12 - ema26 : null;
    const support20 = Math.min(...rows.slice(-20).map(r => r.low));
    const resistance20 = Math.max(...rows.slice(-20).map(r => r.high));

    const changePct = previous?.close
      ? ((last.close / previous.close) - 1) * 100
      : null;

    // RSI và phân tích Reversal
    const rsi14 = rsi(closes);

    const maTrend =
      ma20 != null && ma50 != null
        ? last.close > ma20 && ma20 > ma50
          ? "Tăng"
          : last.close < ma20 && ma20 < ma50
            ? "Giảm"
            : "Trung tính"
        : "Chưa đủ dữ liệu";

    const rsiState =
      rsi14 == null
        ? "Chưa đủ dữ liệu"
        : rsi14 >= 70
          ? "Quá mua"
          : rsi14 <= 30
            ? "Quá bán"
            : "Trung tính";

    const bullishCandle = last.close > last.open;
    const bearishCandle = last.close < last.open;

    let reversal = "Chưa xác nhận";
    let reversalDetail =
      "Chưa có đủ điều kiện đồng thuận; chờ thêm nến xác nhận.";

    if (
      rsi14 != null &&
      rsi14 <= 30 &&
      bullishCandle &&
      previous &&
      last.close > previous.close
    ) {
      reversal = "Có dấu hiệu đảo chiều tăng";
      reversalDetail =
        "RSI ở vùng quá bán và nến gần nhất tăng; cần chờ xác nhận tiếp theo.";
    } else if (
      rsi14 != null &&
      rsi14 >= 70 &&
      bearishCandle &&
      previous &&
      last.close < previous.close
    ) {
      reversal = "Có dấu hiệu đảo chiều giảm";
      reversalDetail =
        "RSI ở vùng quá mua và nến gần nhất giảm; cần chờ xác nhận tiếp theo.";
    } else if (maTrend === "Tăng" && rsi14 != null && rsi14 < 70) {
      reversal = "Xu hướng tăng, chưa xác nhận đảo chiều";
      reversalDetail =
        "Giá trên MA20 và MA20 trên MA50; chưa đủ điều kiện kết luận đảo chiều.";
    } else if (maTrend === "Giảm" && rsi14 != null && rsi14 > 30) {
      reversal = "Xu hướng giảm, chưa xác nhận đảo chiều";
      reversalDetail =
        "Giá dưới MA20 và MA20 dưới MA50; chưa đủ điều kiện kết luận đảo chiều.";
    }

    // Volume Profile: chỉ tính khi nguồn có volume dương.
    const volumeRows = rows.filter(
      (row) => Number.isFinite(row.volume) && row.volume > 0
    );

    let volumeProfile = null;

    if (volumeRows.length >= 10) {
      const low = Math.min(...volumeRows.map((row) => row.low));
      const high = Math.max(...volumeRows.map((row) => row.high));
      const binCount = 24;
      const binSize = (high - low) / binCount || 1;

      const bins = Array.from({ length: binCount }, (_, index) => ({
        low: low + index * binSize,
        high: low + (index + 1) * binSize,
        volume: 0
      }));

      for (const row of volumeRows) {
        const typical = (row.high + row.low + row.close) / 3;
        const index = Math.max(
          0,
          Math.min(
            binCount - 1,
            Math.floor((typical - low) / binSize)
          )
        );

        bins[index].volume += row.volume;
      }

      const sortedBins = [...bins].sort(
        (a, b) => b.volume - a.volume
      );

      const totalVolume = bins.reduce(
        (sum, bin) => sum + bin.volume,
        0
      );

      const targetVolume = totalVolume * 0.7;
      const valueBins = [];
      let accumulated = 0;

      for (const bin of sortedBins) {
        if (accumulated >= targetVolume) break;
        valueBins.push(bin);
        accumulated += bin.volume;
      }

      volumeProfile = {
        poc: (sortedBins[0].low + sortedBins[0].high) / 2,
        vah: Math.max(...valueBins.map((bin) => bin.high)),
        val: Math.min(...valueBins.map((bin) => bin.low)),
        bins: bins.map((bin) => ({
          low: round(bin.low),
          high: round(bin.high),
          volume: round(bin.volume)
        })),
        source: "Twelve Data volume"
      };
    }

    // Các mức DCA tham khảo theo ATR
    const dca =
      atr14 == null
        ? []
        : [
            {
              label: "DCA 1",
              price: round(last.close - atr14),
              distanceAtr: 1
            },
            {
              label: "DCA 2",
              price: round(last.close - atr14 * 1.5),
              distanceAtr: 1.5
            },
            {
              label: "DCA 3",
              price: round(last.close - atr14 * 2),
              distanceAtr: 2
            }
          ];

    return NextResponse.json(
      {
        symbol: "XAUUSD",
        providerSymbol: "XAU/USD",
        interval,
        currency: "USD",
        price: round(last.close),
        changePct: round(changePct),

        indicators: {
          rsi14: round(rsi14),
          ma20: round(ma20),
          ma50: round(ma50),
          ma200: round(ma200),
          atr14: round(atr14),
          atrPct: round(atr14 != null ? atr14 / last.close * 100 : null),
          macd: round(macd),
          bollingerUpper: round(mean20 + 2 * std20),
          bollingerLower: round(mean20 - 2 * std20),
          support20: round(support20),
          resistance20: round(resistance20)
        },

        dca,
        volumeProfile,

        analysis: {
          reversal,
          reversalDetail,
          rsiState,
          maTrend,
          technicalSummary: [
            maTrend === "Tăng" ? "Giá trên MA20 và MA20 trên MA50: xu hướng ngắn-trung hạn nghiêng tăng." : maTrend === "Giảm" ? "Giá dưới MA20 và MA20 dưới MA50: xu hướng ngắn-trung hạn nghiêng giảm." : "Các đường trung bình chưa đồng thuận; chờ xác nhận.",
            rsi14 != null && rsi14 >= 70 ? "RSI quá mua: tránh mua đuổi, theo dõi khả năng điều chỉnh." : rsi14 != null && rsi14 <= 30 ? "RSI quá bán: có thể hồi kỹ thuật nhưng chưa xác nhận đảo chiều." : "RSI chưa ở vùng quá mua/quá bán.",
            atr14 != null ? `ATR(14) = ${round(atr14)} USD, tương đương ${round(atr14 / last.close * 100)}% giá; dùng để ước lượng biến động, không phải dự báo chắc chắn.` : "Chưa đủ dữ liệu ATR."
          ]
        },

        history: rows.slice(-220).map((row) => ({
          date: row.date,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume
        })),

        source: "Twelve Data",
        updatedAt: last.date,
        note:
          "Giá XAU/USD từ Twelve Data; không phải giá khớp lệnh của một broker cụ thể."
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Không thể kết nối Twelve Data lúc này. Vui lòng thử lại sau."
      },
      { status: 502 }
    );
  }
}
