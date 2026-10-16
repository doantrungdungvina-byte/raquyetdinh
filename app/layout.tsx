import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DECISION DESK - CÔNG CỤ HỖ TRỢ RA QUYẾT ĐỊNH ONLINE",
  description: "DECISION DESK - Công cụ hỗ trợ ra quyết định online, so sánh các lựa chọn theo tiêu chí đánh giá và xếp hạng tự động.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}