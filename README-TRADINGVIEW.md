# TD Finance Tools — TradingView Advanced Chart XAUUSD

## Thay đổi
- Giữ nguyên các tab VN Stock, Forex/XAUUSD, Khối ngoại, Chứng chỉ quỹ và các API đang có.
- Thêm TradingView Advanced Chart nhúng cho `FX_IDC:XAUUSD` trong tab Forex khi chọn XAUUSD.
- Biểu đồ mặc định M15, múi giờ Asia/Ho_Chi_Minh; có RSI và MA trên widget.
- Giữ API MT5 hiện có nếu dự án đã dùng bridge; các chỉ số API bên dưới vẫn tách biệt với widget TradingView.

## Triển khai
1. Giải nén ZIP và sao chép các file vào repo hiện tại, giữ nguyên các biến môi trường đang dùng.
2. Commit/push lên GitHub để Vercel deploy.
3. Vào tab `FOREX / XAUUSD`, chọn `XAUUSD`; biểu đồ TradingView xuất hiện phía trên phần chỉ số hiện có.

## Lưu ý quan trọng
TradingView widget là biểu đồ nhúng, không phải API dữ liệu thô. Giá hiển thị có thể có độ trễ theo nguồn dữ liệu TradingView. RSI/Reversal/DCA ở các bảng của website tiếp tục sử dụng dữ liệu từ API hiện tại; widget không thay thế nguồn dữ liệu cho các phép tính này. Nếu muốn tất cả chỉ số tính từ đúng `FX_IDC:XAUUSD`, cần một API dữ liệu có quyền truy cập OHLC tương ứng.

## Chạy local
Yêu cầu Node.js 20.9+. Chạy `npm install`, sau đó `npm run dev`. Trước khi triển khai production, chạy `npm run build`.
