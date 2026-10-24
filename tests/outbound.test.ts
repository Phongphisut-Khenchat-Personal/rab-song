import { describe, expect, it } from "vitest";
import { externalNotice, unconfiguredProvider, type OutboundProvider } from "@/server/outbound";

describe("outbound notifications", () => {
  it("stays not configured and does not claim the message was sent", async () => {
    const result = await unconfiguredProvider("push").send({ ...externalNotice(), recipientUserId: "user-1" });
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.status).not.toBe("SENT");
  });

  it("keeps a failed provider as failed", async () => {
    const provider: OutboundProvider = {
      channel: "sms",
      async send() {
        return { status: "FAILED", error: "เครือข่ายขาด" };
      },
    };
    const result = await provider.send({ ...externalNotice(), recipientUserId: "user-1" });
    expect(result).toEqual({ status: "FAILED", error: "เครือข่ายขาด" });
  });

  it("does not put a child name in the external notice", () => {
    const notice = externalNotice();
    expect(notice.body).not.toMatch(/เด็ก/);
    expect(notice.title + notice.body).not.toMatch(/บ้าน|โรงเรียน/);
  });
});
