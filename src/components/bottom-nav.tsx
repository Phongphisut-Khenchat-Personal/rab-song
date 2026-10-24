"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bus, CalendarOff, Clock3, House, Route, Users, Wallet } from "lucide-react";
import type { UserRole } from "@prisma/client";

const items: Record<UserRole, { href: string; label: string; icon: typeof House }[]> = {
  OWNER: [
    { href: "/owner", label: "วันนี้", icon: House },
    { href: "/owner/students", label: "เด็ก", icon: Users },
    { href: "/owner/routes", label: "เส้นทาง", icon: Route },
    { href: "/owner/payments", label: "เงิน", icon: Wallet },
    { href: "/driver", label: "ขับ", icon: Bus },
  ],
  DRIVER: [{ href: "/driver", label: "วันนี้", icon: House }],
  GUARDIAN: [
    { href: "/guardian", label: "วันนี้", icon: House },
    { href: "/guardian/absence", label: "แจ้งลา", icon: CalendarOff },
    { href: "/guardian/history", label: "ประวัติ", icon: Clock3 },
  ],
};

function isCurrent(path: string, href: string): boolean {
  if (href === "/owner") return path === "/owner";
  if (href === "/guardian") return path === "/guardian";
  if (href === "/driver") return path === "/driver" || path.startsWith("/driver/");
  return path === href || path.startsWith(`${href}/`);
}

export function BottomNav({ role, wide = false }: { role: UserRole; wide?: boolean }) {
  const path = usePathname();
  return (
    <nav className={wide ? "nav wide" : "nav"} aria-label="เมนูหลัก">
      {items[role].map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} aria-current={isCurrent(path, item.href) ? "page" : undefined}>
            <Icon aria-hidden="true" strokeWidth={2.4} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
