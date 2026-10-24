import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "รับส่ง Rab-Song",
    short_name: "รับส่ง",
    description: "ระบบรับส่งนักเรียนสำหรับรถรับส่งรายย่อย",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1e8",
    theme_color: "#173528",
    lang: "th",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
