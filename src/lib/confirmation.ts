export type MutationReceipt = {
  ok?: boolean;
  confirmed?: boolean;
  retryable?: boolean;
  replayed?: boolean;
  message?: string;
  notification?: {
    inApp?: "recorded" | "not_applicable";
    push?: "not_configured" | "sent" | "failed";
  };
  error?: { code?: string; message?: string };
};

export function pushStatusLabel(push: string | null | undefined): string {
  if (push === "SENT") return "พุชส่งแล้ว";
  if (push === "FAILED") return "พุชส่งไม่สำเร็จ";
  if (push === "PENDING" || push === "RECORDED") return "พุชยังไม่ได้รับการยืนยัน";
  return "พุชยังไม่ได้ตั้งค่า";
}

export function canShowConfirmed(receipt: MutationReceipt | null | undefined): boolean {
  return receipt?.ok === true && receipt.confirmed === true;
}

export function confirmedMessage(receipt: MutationReceipt): string {
  if (receipt.notification?.inApp === "recorded" && receipt.notification.push === "not_configured") {
    return "บันทึกแล้ว มีการแจ้งในแอปผู้ปกครอง ส่วนพุชยังไม่ได้ตั้งค่า จึงยังไม่ได้ส่งพุช";
  }
  if (receipt.replayed) return "รายการนี้ถูกบันทึกไว้แล้ว";
  return "บันทึกแล้ว";
}
