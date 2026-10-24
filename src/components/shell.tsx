import { Bell } from "lucide-react";
import type { Actor } from "@/server/auth";
import { BottomNav } from "@/components/bottom-nav";
import { Connectivity } from "@/components/connectivity";
import { LogoutButton } from "@/components/logout-button";

export function Shell({
  actor,
  wide = false,
  alertCount = 0,
  children,
}: {
  actor: Actor;
  wide?: boolean;
  alertCount?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="topbar">
        <div className={wide ? "topbar-inner wide" : "topbar-inner"}>
          <div className="brand">รับส่ง</div>
          <div className="who">
            {alertCount > 0 ? (
              <a className="bell" href="#alerts" aria-label={`แจ้งเตือน ${alertCount} รายการ`}>
                <Bell size={20} aria-hidden="true" />
                <b>{alertCount > 9 ? "9+" : alertCount}</b>
              </a>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </header>
      <Connectivity />
      <main className={wide ? "screen wide" : "screen"}>{children}</main>
      <BottomNav role={actor.role} wide={wide} />
    </>
  );
}
