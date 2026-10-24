export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function isThaiMobile(phone: string): boolean {
  return /^0\d{9}$/.test(phone);
}
