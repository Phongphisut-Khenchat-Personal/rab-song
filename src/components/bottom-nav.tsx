"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";

const items: Record<UserRole, { href: string; label: string }[]> = {
  OWNER: [
    { href: "/owner", label: "ภาพรวม" },
    { href: "/owner/students", label: "นักเรียน" },
    { href: "/owner/routes", label: "เส้นทาง" },
    { href: "/owner/payments", label: "เงิน" },
    { href: "/driver", label: "ขับรถ" },
  ],
  DRIVER: [{ href: "/driver", label: "รอบรถ" }],
  GUARDIAN: [
    { href: "/guardian", label: "สถานะ" },
    { href: "/guardian/absence", label: "แจ้งหยุด" },
    { href: "/guardian/history", label: "ประวัติ" },
  ],
};

function isCurrent(path: string, href: string): boolean {
  if (href === "/owner") return path === "/owner";
  if (href === "/guardian") return path === "/guardian";
  if (href === "/driver") return path === "/driver" || path.startsWith("/driver/");
  return path === href || path.startsWith(`${href}/`);
}

export function BottomNav({ role }: { role: UserRole }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="เมนูหลัก">
      {items[role].map((item) => (
        <Link key={item.href} href={item.href} aria-current={isCurrent(path, item.href) ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
