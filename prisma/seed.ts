import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { assertDevelopmentSeedAllowed } from "../src/lib/seed-guard";
import { addDays, bangkokDayOfWeek, bangkokYmd, dateFromYmd, todayYearMonth } from "../src/lib/time";

const kids = [
  { key: "a", prefix: "เด็กชาย" as const, firstName: "ตัวอย่าง", lastName: "หนึ่ง", nickname: "น้องหนึ่ง", stop: 1, allergy: null },
  { key: "a", prefix: "เด็กหญิง" as const, firstName: "ตัวอย่าง", lastName: "สอง", nickname: "น้องสอง", stop: 1, allergy: "แพ้ถั่วตัวอย่าง" },
  { key: "b", prefix: "เด็กชาย" as const, firstName: "ตัวอย่าง", lastName: "สาม", nickname: "น้องสาม", stop: 2, allergy: null },
  { key: "b", prefix: "เด็กหญิง" as const, firstName: "ตัวอย่าง", lastName: "สี่", nickname: "น้องสี่", stop: 2, allergy: null },
  { key: "b", prefix: "เด็กชาย" as const, firstName: "ตัวอย่าง", lastName: "ห้า", nickname: "น้องห้า", stop: 2, allergy: null },
];

async function main() {
  assertDevelopmentSeedAllowed();
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(databaseUrl)) {
    throw new Error("seed ลบข้อมูลทั้งฐาน จึงใช้ได้เฉพาะฐานบนเครื่องนี้");
  }
  const database = new URL(databaseUrl);
  console.log(`ใช้ฐานพัฒนา ${database.host}${database.pathname}`);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "StudentTripEvent", "VehicleInspection", "RunStopSnapshot", "RouteVersionStop",
      "RouteVersion", "RouteImpact", "ServiceException", "AuthorizedPickupPerson",
      "Place", "ServiceSurvey", "ServiceAgreement", "ServiceLead", "OperatingPolicy",
      "SyncInbox", "AuditLog", "Notification", "Payment", "Invoice",
      "RunCheckpoint", "AttendanceEvent", "StudentRunState", "AbsenceRequest",
      "ScheduleRun", "Schedule", "StudentRouteAssignment", "RouteStop", "Route",
      "StudentGuardian", "Student", "Vehicle", "School", "Session",
      "Guardian", "Driver", "User"
    RESTART IDENTITY CASCADE
  `);

  const ownerHash = await hashPassword("DevOwner#2569");
  const guardianHash = await hashPassword("DevGuard#2569");
  const owner = await prisma.user.create({
    data: { phone: "0800000001", name: "คนขับ ตัวอย่าง", passwordHash: ownerHash, role: "OWNER" },
  });
  const driver = await prisma.driver.create({ data: { userId: owner.id } });
  const guardianUserA = await prisma.user.create({
    data: { phone: "0800000002", name: "ผู้ปกครอง ตัวอย่าง ก", passwordHash: guardianHash, role: "GUARDIAN" },
  });
  const guardianUserB = await prisma.user.create({
    data: { phone: "0800000003", name: "ผู้ปกครอง ตัวอย่าง ข", passwordHash: guardianHash, role: "GUARDIAN" },
  });
  const guardianA = await prisma.guardian.create({ data: { userId: guardianUserA.id } });
  const guardianB = await prisma.guardian.create({ data: { userId: guardianUserB.id } });
  const school = await prisma.school.create({
    data: {
      name: "โรงเรียนตัวอย่างพัฒนาการ",
      address: "จุดตัวอย่างหน้าโรงเรียน ไม่ใช่ที่อยู่จริง",
      latitude: "13.730800",
      longitude: "100.541800",
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: { plateNumber: "ทด-0001", label: "รถตัวอย่าง", capacity: 8, driverId: driver.id },
  });
  const morning = await prisma.route.create({ data: { name: "สายเช้าตัวอย่าง", schoolId: school.id, vehicleId: vehicle.id } });
  const evening = await prisma.route.create({ data: { name: "สายเย็นตัวอย่าง", schoolId: school.id, vehicleId: vehicle.id } });
  const morningStops = await createStops(morning.id, [
    ["จุดตัวอย่าง ซอย 1", "ซอยตัวอย่าง 1 ไม่ใช่บ้านจริง", "13.731200", "100.541200"],
    ["จุดตัวอย่าง ซอย 2", "ซอยตัวอย่าง 2 ไม่ใช่บ้านจริง", "13.729500", "100.544000"],
    ["โรงเรียนตัวอย่างพัฒนาการ", "จุดตัวอย่างหน้าโรงเรียน", "13.730800", "100.541800"],
  ]);
  const eveningStops = await createStops(evening.id, [
    ["โรงเรียนตัวอย่างพัฒนาการ", "จุดตัวอย่างหน้าโรงเรียน", "13.730800", "100.541800"],
    ["จุดตัวอย่าง ซอย 2", "ซอยตัวอย่าง 2 ไม่ใช่บ้านจริง", "13.729500", "100.544000"],
    ["จุดตัวอย่าง ซอย 1", "ซอยตัวอย่าง 1 ไม่ใช่บ้านจริง", "13.731200", "100.541200"],
  ]);

  for (const [index, kid] of kids.entries()) {
    const student = await prisma.student.create({
      data: {
        prefix: kid.prefix,
        firstName: kid.firstName,
        lastName: kid.lastName,
        nickname: kid.nickname,
        schoolId: school.id,
        emergencyContactName: kid.key === "a" ? "ผู้ปกครอง ตัวอย่าง ก" : "ผู้ปกครอง ตัวอย่าง ข",
        emergencyContactPhone: `080000010${index + 1}`,
        allergyNote: kid.allergy,
        serviceStatus: "ACTIVE",
        gradeLevel: "ป.1",
        consentAt: new Date(),
        serviceStart: dateFromYmd(bangkokYmd()),
      },
    });
    await prisma.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: kid.key === "a" ? guardianA.id : guardianB.id,
        relationship: "ผู้ปกครอง",
        isPrimary: true,
      },
    });
    await prisma.authorizedPickupPerson.create({
      data: {
        studentId: student.id,
        name: kid.key === "a" ? "ผู้ปกครอง ตัวอย่าง ก" : "ผู้ปกครอง ตัวอย่าง ข",
        relationship: "ผู้ปกครอง",
        phone: kid.key === "a" ? "0800000002" : "0800000003",
      },
    });
    const morningPickup = morningStops[kid.stop - 1];
    const eveningDropoff = eveningStops[kid.stop === 1 ? 2 : 1];
    await prisma.studentRouteAssignment.create({
      data: { studentId: student.id, routeId: morning.id, pickupStopId: morningPickup.id, dropoffStopId: morningStops[2].id },
    });
    await prisma.studentRouteAssignment.create({
      data: { studentId: student.id, routeId: evening.id, pickupStopId: eveningStops[0].id, dropoffStopId: eveningDropoff.id },
    });
    await prisma.invoice.create({
      data: { studentId: student.id, yearMonth: todayYearMonth(), amountSatang: 350000, status: index === 0 ? "PARTIAL" : "UNPAID" },
    });
  }

  for (const routeId of [morning.id, evening.id]) {
    for (let day = 0; day <= 6; day += 1) {
      await prisma.schedule.create({
        data: {
          routeId,
          period: routeId === morning.id ? "MORNING" : "EVENING",
          dayOfWeek: day,
          plannedStartTime: routeId === morning.id ? "06:20" : "15:40",
        },
      });
    }
  }

  const yesterday = addDays(bangkokYmd(), -1);
  const schedule = await prisma.schedule.findFirstOrThrow({
    where: { routeId: morning.id, period: "MORNING", dayOfWeek: bangkokDayOfWeek(yesterday) },
  });
  const run = await prisma.scheduleRun.create({
    data: {
      scheduleId: schedule.id,
      serviceDate: dateFromYmd(yesterday),
      driverId: driver.id,
      status: "COMPLETED",
      startedAt: new Date(`${yesterday}T00:20:00.000Z`),
      completedAt: new Date(`${yesterday}T01:30:00.000Z`),
    },
  });
  const students = await prisma.student.findMany();
  for (const student of students) {
    await prisma.studentRunState.create({
      data: { runId: run.id, studentId: student.id, status: "ALIGHTED", disposition: "DROPPED_OFF" },
    });
    await prisma.attendanceEvent.create({
      data: {
        runId: run.id,
        studentId: student.id,
        eventType: "BOARD",
        idempotencyKey: `seed-board-${student.id}`,
        previousStatus: "WAITING",
        nextStatus: "BOARDED",
        recordedByUserId: owner.id,
        recordedAt: new Date(`${yesterday}T00:30:00.000Z`),
      },
    });
    await prisma.attendanceEvent.create({
      data: {
        runId: run.id,
        studentId: student.id,
        eventType: "ALIGHT",
        idempotencyKey: `seed-alight-${student.id}`,
        previousStatus: "BOARDED",
        nextStatus: "ALIGHTED",
        recordedByUserId: owner.id,
        recordedAt: new Date(`${yesterday}T01:20:00.000Z`),
      },
    });
  }
  await prisma.runCheckpoint.createMany({
    data: [
      { runId: run.id, kind: "ARRIVED_SCHOOL", passed: true, missingJson: [], checkedByUserId: owner.id },
      { runId: run.id, kind: "RUN_FINISHED", passed: true, missingJson: [], checkedByUserId: owner.id },
    ],
  });
  const firstInvoice = await prisma.invoice.findFirstOrThrow({ where: { status: "PARTIAL" } });
  await prisma.payment.create({
    data: {
      invoiceId: firstInvoice.id,
      amountSatang: 150000,
      method: "TRANSFER",
      paidAt: new Date(),
      recordedByUserId: owner.id,
      idempotencyKey: "seed-payment-partial",
      note: "ข้อมูลตัวอย่าง",
    },
  });
  await prisma.serviceLead.create({
    data: {
      guardianName: "ผู้สนใจ ตัวอย่าง",
      phone: "0800000099",
      childNickname: "น้องยังไม่ลงทะเบียน",
      schoolName: "โรงเรียนตัวอย่างพัฒนาการ",
      status: "LEAD",
      note: "ข้อมูลตัวอย่าง ไม่ใช่ลูกค้าจริง และยังไม่ใช่นักเรียนในรอบรถ",
      createdByUserId: owner.id,
    },
  });
  await prisma.operatingPolicy.create({
    data: {
      id: "default",
      noShowContactInstruction: "โทรหาผู้ปกครองตามเบอร์ฉุกเฉิน แล้วรอคำสั่งจากคนขับ ห้ามปล่อยเด็กไว้ตามลำพัง",
      noReceiverInstruction: "ถ้าไม่มีผู้รับที่ได้รับอนุญาต ให้อยู่กับเด็กบนรถและโทรหาคนขับ ห้ามปล่อยเด็กไว้ตามลำพัง",
    },
  });
  console.log("ใส่ข้อมูลตัวอย่างสำหรับพัฒนาแล้ว ไม่ใช่ข้อมูลเด็กจริง");
}

async function createStops(routeId: string, rows: string[][]) {
  const stops = [];
  for (const [index, row] of rows.entries()) {
    stops.push(
      await prisma.routeStop.create({
        data: {
          routeId,
          sequence: index + 1,
          name: row[0],
          address: row[1],
          latitude: row[2],
          longitude: row[3],
        },
      }),
    );
  }
  return stops;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
