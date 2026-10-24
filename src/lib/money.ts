export function bahtToSatang(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [baht, fraction = ""] = value.split(".");
  const satang = Number(baht) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(satang) || satang <= 0 || satang > 100_000_000) return null;
  return satang;
}

export function formatBaht(satang: number): string {
  const sign = satang < 0 ? "-" : "";
  const absolute = Math.abs(satang);
  const baht = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${baht.toLocaleString("th-TH")}.${fraction} บาท`;
}
