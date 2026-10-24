"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function NoticeToaster({ items }: { items: { id: string; title: string; body: string }[] }) {
  useEffect(() => {
    const seen = new Set((sessionStorage.getItem("rabsong-toasted") ?? "").split(",").filter(Boolean));
    let changed = false;
    for (const item of items.slice(0, 3)) {
      if (seen.has(item.id)) continue;
      toast(item.title, { description: item.body, id: item.id, duration: 6000 });
      seen.add(item.id);
      changed = true;
    }
    if (changed) sessionStorage.setItem("rabsong-toasted", [...seen].slice(-40).join(","));
  }, [items]);
  return null;
}
