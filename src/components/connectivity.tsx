"use client";

import { useEffect, useState } from "react";
import { browserQueue, flushBrowserQueue, forcedOffline } from "@/lib/browser-queue";

export function Connectivity() {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [dev, setDev] = useState(false);
  const [forced, setForced] = useState(false);

  async function refresh() {
    const items = await browserQueue.list().catch(() => []);
    setQueued(items.filter((item) => !item.confirmed && item.state !== "rejected").length);
    setForced(forcedOffline());
  }

  useEffect(() => {
    const update = () => setOnline(navigator.onLine && !forcedOffline());
    update();
    void refresh();
    void fetch("/api/health")
      .then((response) => response.json())
      .then((body) => setDev(body.environment === "development"))
      .catch(() => setOnline(false));
    const onOnline = () => {
      update();
      void flushBrowserQueue().then(refresh);
    };
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", update);
    };
  }, []);

  const offline = !online || forced;
  return (
    <div className={offline ? "banner warn" : "banner ok"} role="status">
      <div className="screen" style={{ paddingTop: 10, paddingBottom: 10 }}>
        {offline
          ? "ออฟไลน์ — รายการที่กดได้จะอยู่ในคิว และจะยังไม่ขึ้นว่าบันทึกแล้ว"
          : "ออนไลน์ — สถานะบันทึกสำเร็จจะขึ้นเมื่อเซิร์ฟเวอร์ยืนยันแล้วเท่านั้น"}
        {queued > 0 ? <div>รอซิงก์ {queued} รายการ</div> : null}
        {dev ? (
          <label className="check">
            <input
              type="checkbox"
              checked={forced}
              onChange={(event) => {
                localStorage.setItem("rabsong-force-offline", event.target.checked ? "1" : "0");
                setForced(event.target.checked);
                setOnline(navigator.onLine && !event.target.checked);
                if (!event.target.checked) void flushBrowserQueue().then(refresh);
              }}
            />
            จำลองออฟไลน์สำหรับพัฒนา
          </label>
        ) : null}
      </div>
    </div>
  );
}
