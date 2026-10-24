const modifiers: Record<string, string> = {
  left: "เลี้ยวซ้าย",
  right: "เลี้ยวขวา",
  "slight left": "ชิดซ้าย",
  "slight right": "ชิดขวา",
  "sharp left": "เลี้ยวซ้าย",
  "sharp right": "เลี้ยวขวา",
  straight: "ตรงไป",
  uturn: "กลับรถ",
};

export function maneuverText(type: string | undefined, modifier: string | undefined, name: string | undefined): string {
  const road = name?.trim() ? ` ${name.trim()}` : "";
  const turn = modifier ? modifiers[modifier] ?? "" : "";
  if (type === "depart") return `ออกเดินทาง${road}`;
  if (type === "arrive") return "ถึงจุดหมาย";
  if (type === "roundabout" || type === "rotary" || type === "exit roundabout") return `เข้าวงเวียน${road}`;
  if (type === "uturn" || modifier === "uturn") return "กลับรถ";
  if (!turn && !road) return "";
  if (!turn) return `ตรงไป${road}`;
  return `${turn}${road}`;
}

export function approximateDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "";
  if (meters < 1000) return `ประมาณ ${Math.max(10, Math.round(meters / 10) * 10)} เมตร`;
  return `ประมาณ ${(Math.round(meters / 100) / 10).toFixed(1)} กม.`;
}
