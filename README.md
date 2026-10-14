# Danh sách lựa chọn — Decision Desk

Website Next.js bằng tiếng Việt để so sánh phương án theo tiêu chí đánh giá.

## Tính năng
- Tên bảng và tên các tiêu chí có thể thay đổi.
- Thêm/xóa/đổi tên lựa chọn; thêm/xóa tiêu chí.
- Chấm điểm từng tiêu chí; tổng điểm, thứ hạng và tỷ lệ % tự tính.
- Chọn quy tắc xếp hạng điểm cao hoặc điểm thấp.
- Nhập Excel (.xlsx, .xls, .csv) và xuất bảng kết quả ra Excel.
- Nút Print Out để in báo cáo; nút PDF mở hộp thoại in của trình duyệt để chọn “Save as PDF” / “Lưu dưới dạng PDF”.
- Tự lưu trong `localStorage` của trình duyệt đang dùng.
- Giao diện responsive cho máy tính và điện thoại.
- Dữ liệu mẫu được dựng theo file `Phan bo danh muc.xlsx`: Vàng, Chứng khoán, BĐS, Tiền gửi; tiêu chí An toàn, Lợi nhuận, Thanh khoản, Tiêu chí 4, Tiêu chí 5.

## Chạy trên máy
Cần Node.js 20 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Triển khai Vercel
1. Giải nén ZIP và đưa toàn bộ thư mục vào một GitHub repository.
2. Vào Vercel → Add New → Project → chọn repository.
3. Framework tự nhận diện Next.js; nhấn Deploy.
4. Không cần biến môi trường cho bản hiện tại.

## Lưu ý dữ liệu
Bản khởi đầu lưu dữ liệu ở trình duyệt hiện tại, chưa đồng bộ giữa nhiều máy/người dùng và chưa có đăng nhập admin. Nếu cần sử dụng chung cho nhiều người, bước tiếp theo nên kết nối Supabase và phân quyền quản trị trước khi đưa dữ liệu thật vào.

- Bảng phân bổ vốn đầu tư: nhập tổng vốn có thể thay đổi, tính tỷ trọng điểm và số vốn phân bổ cho từng lựa chọn; thông tin vốn được lưu cùng cấu hình và đưa vào file Excel xuất ra.

- Footer ủng hộ tác giả “Buy me a Coffee” với mã QR MoMo/VietQR và Techcombank/VietQR do người dùng cung cấp.
