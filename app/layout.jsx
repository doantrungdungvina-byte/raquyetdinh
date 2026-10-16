import "./globals.css";

export const metadata = {
  title: "TD Finance Tools | Công cụ tài chính & kinh doanh",
  description: "TD Finance Tools — công cụ phân tích cổ phiếu, Forex/XAUUSD, chứng chỉ quỹ, DCA, lãi kép, thuế TNCN, lịch vạn niên và tính điểm hòa vốn kinh doanh.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
