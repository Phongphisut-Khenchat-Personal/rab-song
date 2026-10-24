import type { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isThaiMobile, normalizePhone } from "@/lib/phone";
import { dateFromYmd } from "@/lib/time";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";

const ALLOWED: Record<LeadStatus, LeadStatus[]> = {
  LEAD: ["SURVEY_SCHEDULED", "REJECTED", "CANCELLED"],
  SURVEY_SCHEDULED: ["LOCATION_PENDING_VERIFICATION", "LEAD", "CANCELLED"],
  LOCATION_PENDING_VERIFICATION: ["ROUTE_ASSESSMENT", "SURVEY_SCHEDULED", "CANCELLED"],
  ROUTE_ASSESSMENT: ["QUOTE_PENDING", "LOCATION_PENDING_VERIFICATION", "REJECTED", "CANCELLED"],
  QUOTE_PENDING: ["AGREEMENT_PENDING", "ROUTE_ASSESSMENT", "REJECTED", "CANCELLED"],
  AGREEMENT_PENDING: ["REGISTRATION_PENDING", "QUOTE_PENDING", "CANCELLED"],
  REGISTRATION_PENDING: ["SCHEDULE_PENDING", "AGREEMENT_PENDING", "CANCELLED"],
  SCHEDULE_PENDING: ["READY_FOR_SERVICE", "REGISTRATION_PENDING", "CANCELLED"],
  READY_FOR_SERVICE: ["ACTIVE", "SCHEDULE_PENDING", "CANCELLED"],
  ACTIVE: ["SUSPENDED", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "CANCELLED"],
  REJECTED: ["LEAD"],
  CANCELLED: ["LEAD"],
};

const FORWARD = new Set([
  "LEAD>SURVEY_SCHEDULED",
  "SURVEY_SCHEDULED>LOCATION_PENDING_VERIFICATION",
  "LOCATION_PENDING_VERIFICATION>ROUTE_ASSESSMENT",
  "ROUTE_ASSESSMENT>QUOTE_PENDING",
  "QUOTE_PENDING>AGREEMENT_PENDING",
  "AGREEMENT_PENDING>REGISTRATION_PENDING",
  "REGISTRATION_PENDING>SCHEDULE_PENDING",
  "SCHEDULE_PENDING>READY_FOR_SERVICE",
  "READY_FOR_SERVICE>ACTIVE",
  "SUSPENDED>ACTIVE",
]);

export async function createLead(
  actor: Actor,
  input: { guardianName: string; phone: string; childNickname: string; schoolName: string; note?: string },
) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const phone = normalizePhone(input.phone);
  if (!isThaiMobile(phone)) throw new DomainError(422, "INVALID_PHONE", "เบอร์โทรต้องมี 10 หลักขึ้นต้นด้วย 0");
  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceLead.create({
      data: {
        guardianName: input.guardianName.trim(),
        phone,
        childNickname: input.childNickname.trim(),
        schoolName: input.schoolName.trim(),
        note: input.note?.trim() || null,
        status: "LEAD",
        createdByUserId: actor.userId,
      },
    });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "LEAD_CREATED",
      entityType: "ServiceLead",
      entityId: created.id,
      next: { status: "LEAD", childNickname: created.childNickname },
    });
    return created;
  });
  return { id: lead.id, status: lead.status, studentId: null };
}

export async function transitionLead(
  actor: Actor,
  leadId: string,
  input: {
    to: LeadStatus;
    reason?: string;
    scheduledAt?: string;
    assessmentNote?: string;
    quotedSatang?: number;
    accept?: boolean;
    student?: {
      prefix: "เด็กชาย" | "เด็กหญิง";
      firstName: string;
      lastName: string;
      nickname: string;
      schoolId: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      gradeLevel: string;
      serviceStart: string;
      consent: boolean;
    };
  },
) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const lead = await prisma.serviceLead.findUnique({
    where: { id: leadId },
    include: { place: true, agreement: true, student: true },
  });
  if (!lead) throw new DomainError(404, "NOT_FOUND", "ไม่พบลูกค้า");
  if (!ALLOWED[lead.status].includes(input.to)) {
    throw new DomainError(422, "INVALID_TRANSITION", "เปลี่ยนสถานะลูกค้าแบบนี้ไม่ได้");
  }
  const forward = FORWARD.has(`${lead.status}>${input.to}`);
  const reason = input.reason?.trim() ?? "";
  if (!forward && reason.length < 5) {
    throw new DomainError(422, "REASON_REQUIRED", "โปรดระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  }
  await guardTransition(lead, input);
  const saved = await prisma.$transaction(async (tx) => {
    if (input.to === "SURVEY_SCHEDULED" && input.scheduledAt) {
      const scheduledAt = new Date(input.scheduledAt);
      await tx.serviceSurvey.create({ data: { leadId, scheduledAt, note: reason || null } });
      await tx.serviceLead.update({ where: { id: leadId }, data: { scheduledAt } });
    }
    if (input.to === "ROUTE_ASSESSMENT" && input.assessmentNote) {
      await tx.serviceLead.update({ where: { id: leadId }, data: { assessmentNote: input.assessmentNote.trim() } });
    }
    if (input.to === "AGREEMENT_PENDING" && input.quotedSatang) {
      await tx.serviceLead.update({ where: { id: leadId }, data: { quotedSatang: input.quotedSatang } });
      await tx.serviceAgreement.upsert({
        where: { leadId },
        update: { quotedSatang: input.quotedSatang, status: "PENDING", acceptedAt: null },
        create: { leadId, quotedSatang: input.quotedSatang, status: "PENDING" },
      });
    }
    if (input.to === "REGISTRATION_PENDING") {
      await tx.serviceAgreement.update({ where: { leadId }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    }
    if (input.to === "SCHEDULE_PENDING" && input.student && !lead.studentId) {
      const student = await tx.student.create({
        data: {
          prefix: input.student.prefix,
          firstName: input.student.firstName.trim(),
          lastName: input.student.lastName.trim(),
          nickname: input.student.nickname.trim(),
          schoolId: input.student.schoolId,
          emergencyContactName: input.student.emergencyContactName.trim(),
          emergencyContactPhone: normalizePhone(input.student.emergencyContactPhone),
          gradeLevel: input.student.gradeLevel.trim(),
          serviceStart: dateFromYmd(input.student.serviceStart),
          serviceStatus: "DRAFT",
          consentAt: new Date(),
          active: true,
        },
      });
      await tx.serviceLead.update({ where: { id: leadId }, data: { studentId: student.id } });
    }
    if (input.to === "ACTIVE" && lead.studentId) {
      await tx.student.update({ where: { id: lead.studentId }, data: { serviceStatus: "ACTIVE" } });
    }
    if (input.to === "SUSPENDED" && lead.studentId) {
      await tx.student.update({ where: { id: lead.studentId }, data: { serviceStatus: "SUSPENDED" } });
    }
    const row = await tx.serviceLead.update({
      where: { id: leadId },
      data: {
        status: input.to,
        rejectionReason: input.to === "REJECTED" || input.to === "CANCELLED" ? reason : lead.rejectionReason,
      },
    });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "LEAD_TRANSITION",
      entityType: "ServiceLead",
      entityId: leadId,
      previous: { status: lead.status },
      next: { status: input.to, reason: reason || null },
    });
    return row;
  });
  return { id: saved.id, status: saved.status, studentId: saved.studentId };
}

async function guardTransition(
  lead: {
    id: string;
    status: LeadStatus;
    studentId: string | null;
    place: { status: string } | null;
    agreement: { status: string } | null;
    assessmentNote: string | null;
  },
  input: {
    to: LeadStatus;
    scheduledAt?: string;
    assessmentNote?: string;
    quotedSatang?: number;
    accept?: boolean;
    student?: { consent: boolean; emergencyContactPhone: string; schoolId: string };
  },
) {
  if (input.to === "SURVEY_SCHEDULED" && !input.scheduledAt) {
    throw new DomainError(422, "SURVEY_TIME_REQUIRED", "โปรดกำหนดวันเวลานัดสำรวจ");
  }
  if (input.to === "LOCATION_PENDING_VERIFICATION" && !lead.place) {
    throw new DomainError(422, "PLACE_REQUIRED", "ต้องบันทึกจุดก่อนส่งให้ตรวจ");
  }
  if (input.to === "ROUTE_ASSESSMENT") {
    if (!lead.place || (lead.place.status !== "PARENT_CONFIRMED" && lead.place.status !== "FIELD_VERIFIED")) {
      throw new DomainError(422, "PLACE_UNVERIFIED", "ต้องมีคนยืนยันจุดก่อนประเมินเส้นทาง พิกัดอย่างเดียวไม่พอ");
    }
    if ((input.assessmentNote ?? lead.assessmentNote ?? "").trim().length < 5) {
      throw new DomainError(422, "ASSESSMENT_REQUIRED", "โปรดบันทึกผลการดูเส้นทางอย่างน้อย 5 ตัวอักษร");
    }
  }
  if (input.to === "AGREEMENT_PENDING" && (!input.quotedSatang || input.quotedSatang < 1)) {
    throw new DomainError(422, "QUOTE_REQUIRED", "โปรดใส่ราคาที่เสนอ");
  }
  if (input.to === "REGISTRATION_PENDING" && input.accept !== true) {
    throw new DomainError(422, "ACCEPTANCE_REQUIRED", "ต้องบันทึกว่าลูกค้ายืนยันข้อตกลง");
  }
  if (input.to === "SCHEDULE_PENDING") {
    if (!input.student && !lead.studentId) throw new DomainError(422, "STUDENT_REQUIRED", "ต้องลงทะเบียนนักเรียนก่อนจัดตาราง");
    if (input.student && input.student.consent !== true) {
      throw new DomainError(422, "CONSENT_REQUIRED", "ต้องบันทึกว่าผู้ปกครองรับทราบนโยบายข้อมูล");
    }
    if (input.student && !isThaiMobile(normalizePhone(input.student.emergencyContactPhone))) {
      throw new DomainError(422, "INVALID_PHONE", "เบอร์ฉุกเฉินต้องมี 10 หลักขึ้นต้นด้วย 0");
    }
  }
  if (input.to === "READY_FOR_SERVICE") {
    if (!lead.studentId) throw new DomainError(422, "STUDENT_REQUIRED", "ยังไม่มีนักเรียนในรายการนี้");
    await assertReady(lead.studentId);
  }
}

async function assertReady(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      guardians: true,
      authorizedReceivers: { where: { active: true } },
      assignments: { where: { active: true }, include: { pickupStop: { include: { place: true } } } },
    },
  });
  if (!student || student.serviceStatus !== "VERIFIED") {
    throw new DomainError(422, "NOT_VERIFIED", "นักเรียนต้องผ่านการตรวจข้อมูลก่อนพร้อมให้บริการ");
  }
  if (!student.consentAt || student.guardians.length === 0 || student.authorizedReceivers.length === 0 || student.assignments.length === 0) {
    throw new DomainError(422, "PROFILE_INCOMPLETE", "ต้องมีผู้ปกครอง ผู้รับที่ได้รับอนุญาต และการยินยอม ก่อนพร้อมให้บริการ");
  }
  const place = student.assignments[0]?.pickupStop.place;
  if (!place || (place.status !== "PARENT_CONFIRMED" && place.status !== "FIELD_VERIFIED")) {
    throw new DomainError(422, "PLACE_UNVERIFIED", "จุดรับยังไม่มีคนยืนยัน");
  }
}
