import { z } from "zod";

const uuid = z.string().uuid();

export const loginBody = z
  .object({
    phone: z.string().min(9).max(20),
    password: z.string().min(8).max(128),
  })
  .strict();

export const attendanceBody = z
  .object({
    runId: z.string().min(1),
    studentId: z.string().min(1),
    eventType: z.enum(["BOARD", "ALIGHT", "NO_SHOW", "EXCUSE", "DELAY", "ALTERNATE_RECEIVER"]),
    idempotencyKey: uuid,
    note: z.string().max(500).optional(),
    alternateReceiverName: z.string().max(80).optional(),
    clientRecordedAt: z.string().datetime().optional(),
  })
  .strict();

export const correctionBody = z
  .object({
    studentId: z.string().min(1),
    toStatus: z.enum(["WAITING", "BOARDED", "ALIGHTED", "NO_SHOW", "EXCUSED"]),
    reason: z.string().min(10).max(500),
    idempotencyKey: uuid,
  })
  .strict();

export const checkpointBody = z
  .object({
    kind: z.enum(["ARRIVED_SCHOOL", "LEFT_SCHOOL", "RUN_FINISHED"]),
  })
  .strict();

export const absenceBody = z
  .object({
    studentId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().min(3).max(500),
    affectsMorning: z.boolean(),
    affectsEvening: z.boolean(),
    idempotencyKey: uuid,
  })
  .strict();

export const syncBody = z
  .object({
    operations: z
      .array(
        z
          .object({
            idempotencyKey: uuid,
            operationType: z.enum(["ATTENDANCE", "ABSENCE"]),
            clientCreatedAt: z.string().datetime().optional(),
            payload: z.record(z.string(), z.unknown()),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const studentBody = z
  .object({
    prefix: z.enum(["เด็กชาย", "เด็กหญิง"]),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    nickname: z.string().trim().min(1).max(40),
    schoolId: z.string().min(1),
    emergencyContactName: z.string().trim().min(1).max(80),
    emergencyContactPhone: z.string().min(9).max(20),
    allergyNote: z.string().trim().max(200).optional(),
  })
  .strict();

export const schoolBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    address: z.string().trim().min(4).max(200),
  })
  .strict();

export const stopBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    address: z.string().trim().min(4).max(200),
  })
  .strict();

export const assignmentBody = z
  .object({
    studentId: z.string().min(1),
    routeId: z.string().min(1),
    pickupStopId: z.string().min(1),
    dropoffStopId: z.string().min(1),
  })
  .strict();

export const invoiceBody = z
  .object({
    studentId: z.string().min(1),
    yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    amountBaht: z.string().regex(/^\d+(\.\d{1,2})?$/),
  })
  .strict();

export const paymentBody = z
  .object({
    invoiceId: z.string().min(1),
    amountBaht: z.string().regex(/^\d+(\.\d{1,2})?$/),
    method: z.enum(["CASH", "TRANSFER", "OTHER"]),
    note: z.string().max(200).optional(),
    idempotencyKey: uuid,
  })
  .strict();

export const vehicleBody = z
  .object({
    plateNumber: z.string().trim().min(2).max(20),
    label: z.string().trim().min(1).max(40),
    capacity: z.number().int().min(1).max(30),
  })
  .strict();
