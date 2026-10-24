const accounts = [
  { role: "เจ้าของกิจการและคนขับ", phone: "0800000001", password: "DevOwner#2569" },
  { role: "ผู้ปกครอง ก", phone: "0800000002", password: "DevGuard#2569" },
  { role: "ผู้ปกครอง ข", phone: "0800000003", password: "DevGuard#2569" },
];

export async function GET() {
  if (process.env.APP_ENV !== "development") {
    return Response.json({ ok: false, error: { code: "NOT_FOUND", message: "ไม่พบข้อมูล" } }, { status: 404 });
  }
  return Response.json({ ok: true, accounts });
}
