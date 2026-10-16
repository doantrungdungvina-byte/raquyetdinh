# TD Finance Tools — GitHub + Vercel

## What's included in this update
- New `📈 LÃI KÉP` tab: initial capital, periodic contributions (monthly/quarterly), expected annual return, investment horizon, year-by-year projection, and an illustrative financial-independence target using the 4% rule.
- Existing VN stock, FX, funds, DCA tools and donation section are retained.
- TypeScript development dependencies are declared to prevent Next.js build from failing when the project contains `tsconfig.json` or `.tsx` components.
- Donation QR images are copied to `public/` so the component can load them in Next.js.

## Run locally
```bash
npm install
npm run build
npm run dev
```

## Push to GitHub
Create an empty repository on GitHub, then from this project folder run:
```bash
git init
git add .
git commit -m "Add compound interest planner"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```
Replace the URL with your repository URL. If Git is already initialized, skip `git init` and add/update the remote as needed.

## Deploy on Vercel
1. Open https://vercel.com/dashboard and choose **Add New → Project**.
2. Import the GitHub repository.
3. Keep the framework as Next.js and use the default build command `npm run build`.
4. Deploy. Later pushes to the connected branch trigger deployments automatically.

## Notes
- The compounding planner is a scenario estimate, not a guarantee. It assumes a constant annual return converted to monthly/quarterly periods and contributions at the end of each period. It excludes inflation, fees and taxes.
- Market API data may be delayed or unavailable depending on upstream providers.


## Nguồn dữ liệu dự phòng HNX/UPCoM

Khi Yahoo Finance không có mã, `/api/market` và `/api/stock-volume` sẽ gọi hàm Python `/api/vnstock` (VCI, sau đó KBS). Vercel cần cài các phụ thuộc trong `requirements.txt`. Sau khi deploy, thử `/api/vnstock?symbol=IDC` để kiểm tra riêng nguồn Python.


## Fix build Python/Vnstock on Vercel

- Keep `requirements.txt` at the project root.
- `.python-version` pins Python 3.11 for the Vnstock fallback.
- If `pyproject.toml` contains `tool.uv.environments` with `sys_platform == 'win32'`, remove that Windows-only split; Vercel builds on Linux.
- Redeploy and inspect Python dependency resolution logs.


## Vnstock package index
Vnstock v5 is installed from the official package index at `https://vnstocks.com/api/packages`; it is not distributed through PyPI according to the official installation docs. `requirements.txt` therefore includes `--extra-index-url` and pins `vnstock==5.0.1`. The Python endpoint uses the v5 `Quote(...).history(...)` API. Check Vercel build logs for package-index or authentication errors after deployment.

## Thống kê kỹ thuật cổ phiếu từ TradingView
- Endpoint mới: `/api/stock-technical?symbol=IDC&exchange=HNX`.
- Tab VN STOCK có phần **Thống kê kỹ thuật cổ phiếu — TradingView**: Technical Score, Action, kịch bản D1/W1, EMA 9/21/50/200, RSI, MACD, volume/TB10, ATR, đỉnh/đáy 52 tuần, Bollinger Bands và bảng tín hiệu.
- Nếu mã không có dữ liệu ở sàn được chọn, endpoint thử tiếp HNX, HOSE và UPCoM.
- Điểm số và kịch bản là ước tính từ chỉ báo, không phải xác suất thống kê hay khuyến nghị đầu tư.
