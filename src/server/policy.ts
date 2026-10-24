import { prisma } from "@/lib/db";

const defaults = {
  absenceCutoffTime: "21:00",
  noShowContactInstruction: "โทรหาผู้ปกครองตามเบอร์ฉุกเฉิน แล้วรอคำสั่งจากคนขับ ห้ามปล่อยเด็กไว้ตามลำพัง",
  noReceiverInstruction: "ถ้าไม่มีผู้รับที่ได้รับอนุญาต ให้อยู่กับเด็กบนรถและโทรหาคนขับ ห้ามปล่อยเด็กไว้ตามลำพัง",
};

export async function getOperatingPolicy() {
  const row = await prisma.operatingPolicy.findUnique({ where: { id: "default" } });
  return {
    absenceCutoffTime: row?.absenceCutoffTime ?? defaults.absenceCutoffTime,
    noShowContactInstruction: row?.noShowContactInstruction ?? defaults.noShowContactInstruction,
    noReceiverInstruction: row?.noReceiverInstruction ?? defaults.noReceiverInstruction,
  };
}
