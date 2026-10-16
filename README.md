# TD Finance Tools — Next.js + Vercel

Next.js App Router project for VN stock analysis, Forex/XAUUSD, foreign-flow status, and fund NAV lookup.

## Fund NAV feature

- Search by manually entered fund code; autocomplete includes common open-ended funds and Vietnamese ETFs.
- API route: `GET /api/funds/[symbol]`.
- Primary source: Fmarket product search. The API accepts only an exact fund-code match and never substitutes the first search result.
- Fallback: CafeF only when a NAV and percentage pair can be conservatively identified.
- The UI shows NAV, change (when available), NAV date (only when the source supplies it), source attribution, and history/performance only if the response actually contains usable fields.
- Source API is not officially documented. Fmarket/CafeF pages or schemas may change; verify the reported NAV and date against the fund manager's official disclosure. No fabricated NAV dates or history are generated.
- For listed ETFs, exchange-traded price can differ from NAV per unit.

## Run locally

Node.js 20.9 or newer:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. To verify production build:

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Upload the full project directory to the connected GitHub repository (or create a new repository).
2. In Vercel, import that repository.
3. Framework preset: Next.js. Build command: `npm run build`.
4. Deploy, then test `/api/funds/VESAF`, `/api/funds/E1VFVN30`, and the fund tab in the UI.

## Other data limitations

- Yahoo Finance prices can be delayed, missing, or unavailable for some Vietnam tickers.
- XAUUSD uses Twelve Data `XAU/USD`; quotes can differ from individual broker spot prices.
- The foreign-flow endpoint may return an unavailable-data message instead of inventing values.
- DCA levels are technical reference calculations, not investment advice.

## XAU/USD price feed (Twelve Data)

- XAUUSD now uses the Twelve Data `XAU/USD` time-series endpoint, not Yahoo's `GC=F` gold futures and not TradingView.
- Supported intervals: M5 (`5min`), M15 (`15min`), M30 (`30min`), H1 (`1h`), H4 (`4h`), D1 (`1day`).
- Server route: `GET /api/xauusd?interval=5min`.
- Set `TWELVE_DATA_API_KEY` in Vercel → Project → Settings → Environment Variables for Production/Preview as needed, then redeploy. Never use a `NEXT_PUBLIC_` prefix for this key.
- Other Forex/crypto symbols, Vietnamese stock analysis, foreign-flow tab, fund NAV lookup and DCA illustration remain on their existing code paths.
- The application only fetches market data and calculates indicators; it does not place trades.
- Twelve Data access, quota, and data delay depend on the user's plan. XAU/USD provider prices may differ from an individual broker's quote.


## Foreign-flow endpoint (CafeF best-effort)

- Route: `GET /api/foreign?symbol=FPT`.
- The route attempts to parse CafeF's public HTML page server-side and returns only the newest date it can parse.
- No `FOREIGN_FLOW_API_URL` or API token is required for this CafeF attempt.
- CafeF is not treated as a guaranteed public API. If the HTML does not expose a recognizable table, the route returns an explicit error instead of fabricated data.
- Verify values against the CafeF page. HTML structure, access restrictions, and data availability may change.

## Cập nhật phân tích FX / XAUUSD
- Bổ sung ATR(14) và ATR theo % giá để tham khảo độ biến động.
- Bổ sung MACD, Bollinger Bands, hỗ trợ/kháng cự 20 nến.
- Bổ sung phần phân tích kỹ thuật tổng hợp từ MA20/MA50, RSI, Bollinger và ATR.
- Bổ sung bảng mức giá DCA/vùng hỗ trợ tham khảo theo ATR, MA và đáy gần đây.
- Chỉ báo dựa trên dữ liệu lịch sử và nguồn dữ liệu hiện cấu hình; không phải dự báo chắc chắn hay khuyến nghị giao dịch.
