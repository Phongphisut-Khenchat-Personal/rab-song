import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { bangkokDayOfWeek, bangkokYmd } from "@/lib/time";
import { resetLoginLimiter } from "@/server/auth";
import { ensureRunsForDate } from "@/server/runs";

export const PASSWORD = "TestPass#2569";
let plateSerial = 1000;

export async function resetDb(): Promise<void> {
  resetLoginLimiter();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "StudentTripEvent",
      "VehicleInspection",
      "RunStopSnapshot",
      "RouteVersionStop",
      "RouteVersion",
      "RouteImpact",
      "ServiceException",
      "AuthorizedPickupPerson",
      "Place",
      "ServiceSurvey",
      "ServiceAgreement",
      "ServiceLead",
      "OperatingPolicy",
      "SyncInbox",
      "AuditLog",
      "Notification",
      "Payment",
      "Invoice",
      "RunCheckpoint",
      "AttendanceEvent",
      "StudentRunState",
      "AbsenceRequest",
      "ScheduleRun",
      "Schedule",
      "StudentRouteAssignment",
      "RouteStop",
      "Route",
      "StudentGuardian",
      "Student",
      "Vehicle",
      "School",
      "Session",
      "Guardian",
      "Driver",
      "User"
    RESTART IDENTITY CASCADE
  `);
}

export async function createFixture() {
  const owner = await createUser("0811111111", "เจ้าของทดสอบ", "OWNER");
  const driverUser = await createUser("0822222222", "คนขับทดสอบ", "DRIVER");
  const otherUser = await createUser("0833333333", "คนขับคนอื่น", "DRIVER");
  const guardianAUser = await createUser("0844444441", "ผู้ปกครองทดสอบ ก", "GUARDIAN");
  const guardianBUser = await createUser("0844444442", "ผู้ปกครองทดสอบ ข", "GUARDIAN");
  const driver = await prisma.driver.create({ data: { userId: driverUser.id } });
  await prisma.driver.create({ data: { userId: otherUser.id } });
  const guardianA = await prisma.guardian.create({ data: { userId: guardianAUser.id } });
  const guardianB = await prisma.guardian.create({ data: { userId: guardianBUser.id } });
  const school = await prisma.school.create({ data: { name: "โรงเรียนทดสอบ", address: "ที่อยู่ทดสอบ" } });
  const vehicle = await prisma.vehicle.create({
    data: { plateNumber: `ทด-${++plateSerial}`, label: "รถทดสอบ", capacity: 10, driverId: driver.id },
  });
  const student1 = await prisma.student.create({
    data: {
      prefix: "เด็กชาย",
      firstName: "ทดสอบ",
      lastName: "หนึ่ง",
      nickname: "หนึ่ง",
      schoolId: school.id,
      emergencyContactName: "ผู้ปกครอง ก",
      emergencyContactPhone: "0800001111",
    },
  });
  const student2 = await prisma.student.create({
    data: {
      prefix: "เด็กหญิง",
      firstName: "ทดสอบ",
      lastName: "สอง",
      nickname: "สอง",
      schoolId: school.id,
      emergencyContactName: "ผู้ปกครอง ข",
      emergencyContactPhone: "0800002222",
      allergyNote: "แพ้ทดสอบ",
    },
  });
  await prisma.studentGuardian.create({
    data: { studentId: student1.id, guardianId: guardianA.id, relationship: "มารดา", isPrimary: true },
  });
  await prisma.studentGuardian.create({
    data: { studentId: student2.id, guardianId: guardianB.id, relationship: "บิดา", isPrimary: true },
  });
  const route = await prisma.route.create({ data: { name: "รอบเช้าทดสอบ", schoolId: school.id, vehicleId: vehicle.id } });
  const stopHome = await prisma.routeStop.create({
    data: { routeId: route.id, name: "บ้านทดสอบ", sequence: 1, address: "ซอยทดสอบ" },
  });
  const stopSchool = await prisma.routeStop.create({
    data: { routeId: route.id, name: "โรงเรียนทดสอบ", sequence: 2, address: "หน้าโรงเรียนทดสอบ" },
  });
  await prisma.studentRouteAssignment.create({
    data: { studentId: student1.id, routeId: route.id, pickupStopId: stopHome.id, dropoffStopId: stopSchool.id },
  });
  await prisma.studentRouteAssignment.create({
    data: { studentId: student2.id, routeId: route.id, pickupStopId: stopHome.id, dropoffStopId: stopSchool.id },
  });
  await prisma.schedule.create({
    data: { routeId: route.id, period: "MORNING", dayOfWeek: bangkokDayOfWeek(), plannedStartTime: "06:30" },
  });
  await ensureRunsForDate(bangkokYmd());
  const run = await prisma.scheduleRun.findFirstOrThrow({ where: { scheduleId: { not: "" } } });
  return {
    owner,
    driverUser,
    driver,
    otherUser,
    guardianAUser,
    guardianBUser,
    guardianA,
    guardianB,
    student1,
    student2,
    run,
    vehicle,
    route,
  };
}

async function createUser(phone: string, name: string, role: "OWNER" | "DRIVER" | "GUARDIAN") {
  return prisma.user.create({
    data: { phone, name, role, passwordHash: await hashPassword(PASSWORD) },
  });
}

export function api(path: string, options?: { method?: string; body?: unknown; cookie?: string; origin?: string }): Request {
  const headers = new Headers({ host: "localhost:3000" });
  if (options?.body !== undefined) headers.set("content-type", "application/json");
  if (options?.cookie) headers.set("cookie", options.cookie);
  if (options?.origin) headers.set("origin", options.origin);
  return new Request(new URL(path, "http://localhost:3000"), {
    method: options?.method ?? (options?.body === undefined ? "GET" : "POST"),
    headers,
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function cookieFrom(response: Response): string {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const header = cookies[0] ?? response.headers.get("set-cookie");
  if (!header) throw new Error("ไม่พบคุกกี้เซสชัน");
  return header.split(";")[0];
}
