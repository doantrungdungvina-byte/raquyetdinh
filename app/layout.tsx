import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Danh sách lựa chọn | Ra quyết định",
  description: "Công cụ so sánh các lựa chọn theo tiêu chí đánh giá và xếp hạng tự động.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}