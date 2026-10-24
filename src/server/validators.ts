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

export const stopLocationBody = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
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

export const leadBody = z
  .object({
    guardianName: z.string().trim().min(2).max(80),
    phone: z.string().min(9).max(20),
    childNickname: z.string().trim().min(1).max(40),
    schoolName: z.string().trim().min(2).max(120),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const leadTransitionBody = z
  .object({
    to: z.enum([
      "LEAD",
      "SURVEY_SCHEDULED",
      "LOCATION_PENDING_VERIFICATION",
      "ROUTE_ASSESSMENT",
      "QUOTE_PENDING",
      "AGREEMENT_PENDING",
      "REGISTRATION_PENDING",
      "SCHEDULE_PENDING",
      "READY_FOR_SERVICE",
      "ACTIVE",
      "REJECTED",
      "CANCELLED",
      "SUSPENDED",
    ]),
    reason: z.string().max(500).optional(),
    scheduledAt: z.string().datetime().optional(),
    assessmentNote: z.string().max(500).optional(),
    quotedSatang: z.number().int().positive().optional(),
    accept: z.boolean().optional(),
    student: z
      .object({
        prefix: z.enum(["เด็กชาย", "เด็กหญิง"]),
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        nickname: z.string().trim().min(1).max(40),
        schoolId: z.string().min(1),
        emergencyContactName: z.string().trim().min(1).max(80),
        emergencyContactPhone: z.string().min(9).max(20),
        gradeLevel: z.string().trim().min(1).max(20),
        serviceStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        consent: z.literal(true),
      })
      .optional(),
  })
  .strict();

export const placeBody = z
  .object({
    leadId: z.string().optional(),
    routeStopId: z.string().optional(),
    label: z.string().trim().min(1).max(80),
    addressLine: z.string().trim().min(4).max(200),
    directionNote: z.string().max(300).optional(),
    entranceNote: z.string().max(300).optional(),
    parkingNote: z.string().max(300).optional(),
    landmark: z.string().max(200).optional(),
    cautionNote: z.string().max(300).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    coordinateSource: z.enum(["MANUAL_ENTRY", "MAP_PIN", "GEOCODER"]),
  })
  .strict();

export const placeVerifyBody = z
  .object({
    status: z.enum(["PARENT_CONFIRMED", "FIELD_VERIFIED", "REJECTED", "NEEDS_RECHECK"]),
    checkNote: z.string().trim().min(5).max(500),
    confirmedByPerson: z.literal(true),
  })
  .strict();

export const addressSearchBody = z.object({ query: z.string().trim().min(3).max(160) }).strict();

export const publishBody = z
  .object({
    acceptUnverifiedTiming: z.boolean().optional(),
    schoolDeadline: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .strict();

export const estimateBody = z
  .object({
    points: z.array(z.object({ latitude: z.number(), longitude: z.number() }).strict()).min(2).max(30),
  })
  .strict();

export const accountBody = z
  .object({
    role: z.enum(["DRIVER", "GUARDIAN"]),
    name: z.string().trim().min(2).max(80),
    phone: z.string().min(9).max(20),
    password: z.string().min(8).max(128),
    studentId: z.string().optional(),
    relationship: z.string().max(40).optional(),
  })
  .strict();

export const receiverBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    relationship: z.string().trim().min(2).max(40),
    phone: z.string().min(9).max(20).optional(),
  })
  .strict();

export const serviceStatusBody = z
  .object({
    to: z.enum(["NEEDS_VERIFICATION", "VERIFIED", "ACTIVE", "SUSPENDED", "ENDED"]),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const exceptionBody = z
  .object({
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(["HOLIDAY", "SCHOOL_TIME_CHANGE", "VEHICLE_UNAVAILABLE", "DRIVER_UNAVAILABLE"]),
    affectsMorning: z.boolean(),
    affectsEvening: z.boolean(),
    note: z.string().trim().min(3).max(300),
  })
  .strict();

export const inspectionBody = z
  .object({
    kind: z.enum(["PRE_TRIP", "EMPTY_SWEEP"]),
    items: z.record(z.string(), z.boolean()),
    idempotencyKey: uuid,
    note: z.string().max(300).optional(),
  })
  .strict();

export const dispositionBody = z
  .object({
    studentId: z.string().min(1),
    disposition: z.enum(["UNKNOWN", "NOT_BOARDED", "NOT_PRESENT"]),
    idempotencyKey: uuid,
    note: z.string().max(300).optional(),
  })
  .strict();
