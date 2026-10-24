import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "รับส่ง",
  description: "ระบบรับส่งนักเรียนสำหรับรถรับส่งรายย่อย",
  applicationName: "รับส่ง",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
