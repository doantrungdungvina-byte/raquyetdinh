# Tóm tắt thị trường dưới menu

Đã thêm dải 4 thẻ tổng quan ngay dưới menu chính:
- Giá vàng SJC (thử lấy từ endpoint công khai của SJC)
- Tỷ giá tham khảo USD/VND (Yahoo Finance)
- VN-Index (Yahoo Finance)
- Lãi suất VCB (thử đọc trang lãi suất công khai Vietcombank)

API: `GET /api/market-summary`; giao diện tự làm mới sau mỗi 5 phút.

Lưu ý: các nguồn công khai có thể đổi định dạng hoặc chặn truy cập. Khi không lấy được dữ liệu, giao diện sẽ hiển thị “Đang cập nhật”, không tự tạo giá trị. Hãy kiểm tra các số liệu trực tiếp từ ngân hàng/đơn vị cung cấp trước khi sử dụng cho quyết định tài chính.
