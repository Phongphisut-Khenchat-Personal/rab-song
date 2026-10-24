import type { Actor } from "@/server/auth";
import { roleLabel } from "@/lib/labels";
import { BottomNav } from "@/components/bottom-nav";
import { Connectivity } from "@/components/connectivity";
import { LogoutButton } from "@/components/logout-button";

export function Shell({ actor, wide = false, children }: { actor: Actor; wide?: boolean; children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            รับส่ง
            <small>รถรับส่งนักเรียน</small>
          </div>
          <div className="who">
            <div>{actor.name}</div>
            <div>{roleLabel(actor.role)}</div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <Connectivity />
      <main className={wide ? "screen wide" : "screen"}>{children}</main>
      <BottomNav role={actor.role} />
    </>
  );
}
