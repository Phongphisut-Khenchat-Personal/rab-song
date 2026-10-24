import type { Metadata, Viewport } from "next";
import { PhoneToaster } from "@/components/phone-toaster";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "รับส่ง",
  description: "ระบบรับส่งนักเรียนสำหรับรถรับส่งรายย่อย",
  applicationName: "รับส่ง",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff6a00",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        {children}
        <PhoneToaster />
      </body>
    </html>
  );
}
