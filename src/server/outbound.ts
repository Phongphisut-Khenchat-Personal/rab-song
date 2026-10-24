export type OutboundStatus = "NOT_CONFIGURED" | "FAILED" | "SENT";

export type OutboundMessage = {
  recipientUserId: string;
  title: string;
  body: string;
};

export type OutboundResult = {
  status: OutboundStatus;
  error?: string;
};

export interface OutboundProvider {
  readonly channel: "push" | "sms";
  send(message: OutboundMessage): Promise<OutboundResult>;
}

const NOT_CONFIGURED = "ยังไม่ได้ตั้งค่าผู้ให้บริการ จึงยังไม่ได้ส่ง";

export function unconfiguredProvider(channel: "push" | "sms"): OutboundProvider {
  return {
    channel,
    async send() {
      return { status: "NOT_CONFIGURED", error: NOT_CONFIGURED };
    },
  };
}

export function providerFromEnv(channel: "push" | "sms", urlName: string, keyName: string): OutboundProvider {
  const url = process.env[urlName]?.trim();
  const key = process.env[keyName]?.trim();
  if (!url || !key) return unconfiguredProvider(channel);
  return {
    channel,
    async send(message) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({
            recipientUserId: message.recipientUserId,
            title: message.title,
            body: message.body,
          }),
        });
        if (!response.ok) return { status: "FAILED", error: `ผู้ให้บริการตอบ ${response.status}` };
        const body = (await response.json().catch(() => null)) as { accepted?: boolean } | null;
        if (body?.accepted !== true) return { status: "FAILED", error: "ผู้ให้บริการยังไม่ยืนยันว่ารับข้อความ" };
        return { status: "SENT" };
      } catch {
        return { status: "FAILED", error: "ติดต่อผู้ให้บริการไม่ได้" };
      }
    },
  };
}

export function pushProvider(): OutboundProvider {
  return providerFromEnv("push", "PUSH_PROVIDER_URL", "PUSH_PROVIDER_KEY");
}

export function smsProvider(): OutboundProvider {
  return providerFromEnv("sms", "SMS_PROVIDER_URL", "SMS_PROVIDER_KEY");
}

export function externalNotice(): OutboundMessage {
  return {
    recipientUserId: "",
    title: "มีการอัปเดตในแอปรับส่ง",
    body: "เปิดแอปเพื่อดูรายละเอียด",
  };
}
