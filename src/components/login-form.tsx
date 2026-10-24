"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { homeForRole } from "@/lib/home";

type Account = { role: string; phone: string; password: string };

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    void fetch("/api/dev/accounts")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.accounts) setAccounts(body.accounts);
      });
  }, []);

  return (
    <main className="screen">
      <div className="card stack">
        <h1>รับส่ง</h1>
        <p className="muted">เข้าสู่ระบบด้วยเบอร์โทรที่เจ้าของกิจการลงทะเบียนไว้</p>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            setPending(true);
            setMessage("");
            try {
              const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ phone, password }),
              });
              const body = await response.json();
              if (response.ok && body.ok && body.actor?.role) {
                router.replace(homeForRole(body.actor.role));
                router.refresh();
                return;
              }
              setMessage(body.error?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
            } catch {
              setMessage("ติดต่อเซิร์ฟเวอร์ไม่ได้ ยังไม่ได้เข้าสู่ระบบ");
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="field">
            เบอร์โทร
            <input className="text-input" inputMode="tel" autoComplete="username" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          </label>
          <label className="field">
            รหัสผ่าน
            <input className="text-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="btn green" type="submit" disabled={pending}>
            {pending ? "กำลังตรวจ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
        {message ? <div className="banner bad" role="alert">{message}</div> : null}
        {accounts.length > 0 ? (
          <div className="banner info">
            <strong>บัญชีตัวอย่างสำหรับพัฒนาเท่านั้น</strong>
            <ul>
              {accounts.map((account) => (
                <li key={account.phone}>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => {
                      setPhone(account.phone);
                      setPassword(account.password);
                    }}
                  >
                    {account.role} {account.phone}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </main>
  );
}
