-- PostGIS 3.4 is GPL-2.0-or-later. Coordinates stay numeric as well, so a restore
-- onto plain PostgreSQL can keep the business data if the geography column is dropped.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('LEAD', 'SURVEY_SCHEDULED', 'LOCATION_PENDING_VERIFICATION', 'ROUTE_ASSESSMENT', 'QUOTE_PENDING', 'AGREEMENT_PENDING', 'REGISTRATION_PENDING', 'SCHEDULE_PENDING', 'READY_FOR_SERVICE', 'ACTIVE', 'REJECTED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StudentServiceStatus" AS ENUM ('DRAFT', 'NEEDS_VERIFICATION', 'VERIFIED', 'ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('UNVERIFIED', 'PARENT_CONFIRMED', 'FIELD_VERIFIED', 'REJECTED', 'NEEDS_RECHECK');

-- CreateEnum
CREATE TYPE "CoordinateSource" AS ENUM ('MANUAL_ENTRY', 'MAP_PIN', 'GEOCODER');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RouteVersionStatus" AS ENUM ('DRAFT', 'LOCKED', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('UNAVAILABLE', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "ServiceExceptionKind" AS ENUM ('HOLIDAY', 'SCHOOL_TIME_CHANGE', 'VEHICLE_UNAVAILABLE', 'DRIVER_UNAVAILABLE');

-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('PRE_TRIP', 'EMPTY_SWEEP');

-- CreateEnum
CREATE TYPE "TripDisposition" AS ENUM ('NOT_PRESENT', 'ABSENCE_CONFIRMED', 'NOT_BOARDED', 'BOARDED', 'DROPPED_OFF', 'HANDED_TO_AUTHORIZED_PERSON', 'UNKNOWN');

-- AlterTable
ALTER TABLE "AbsenceRequest" ADD COLUMN     "late" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "gradeLevel" TEXT,
ADD COLUMN     "serviceEnd" DATE,
ADD COLUMN     "serviceStart" DATE,
ADD COLUMN     "serviceStatus" "StudentServiceStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "usesEvening" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "usesMorning" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "StudentRunState" ADD COLUMN     "disposition" "TripDisposition" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "dropoffStopId" TEXT,
ADD COLUMN     "pickupStopId" TEXT;

-- CreateTable
CREATE TABLE "ServiceLead" (
    "id" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "childNickname" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'LEAD',
    "note" TEXT,
    "assessmentNote" TEXT,
    "rejectionReason" TEXT,
    "quotedSatang" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "studentId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceSurvey" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAgreement" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "quotedSatang" INTEGER NOT NULL,
    "note" TEXT,
    "status" "AgreementStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "directionNote" TEXT,
    "entranceNote" TEXT,
    "parkingNote" TEXT,
    "landmark" TEXT,
    "cautionNote" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "geog" geography(Point,4326),
    "coordinateSource" "CoordinateSource" NOT NULL DEFAULT 'MANUAL_ENTRY',
    "status" "LocationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "checkNote" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "leadId" TEXT,
    "routeStopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizedPickupPerson" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorizedPickupPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteVersion" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "RouteVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "schoolDeadline" TEXT NOT NULL,
    "dwellSeconds" INTEGER NOT NULL DEFAULT 60,
    "estimateStatus" "EstimateStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "distanceMeters" INTEGER,
    "durationSeconds" INTEGER,
    "estimateNote" TEXT,
    "acceptUnverifiedTiming" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteVersionStop" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "routeStopId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "RouteVersionStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteImpact" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "unchangedRunIds" JSONB NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunStopSnapshot" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "routeStopId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "RunStopSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceException" (
    "id" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "kind" "ServiceExceptionKind" NOT NULL,
    "affectsMorning" BOOLEAN NOT NULL DEFAULT true,
    "affectsEvening" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleInspection" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" "InspectionKind" NOT NULL,
    "items" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "checkedByUserId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTripEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "disposition" "TripDisposition" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "receiverName" TEXT,
    "previousDisposition" "TripDisposition",
    "nextDisposition" "TripDisposition" NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientRecordedAt" TIMESTAMP(3),

    CONSTRAINT "StudentTripEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "absenceCutoffTime" TEXT NOT NULL DEFAULT '21:00',
    "noShowContactInstruction" TEXT NOT NULL,
    "noReceiverInstruction" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLead_studentId_key" ON "ServiceLead"("studentId");

-- CreateIndex
CREATE INDEX "ServiceLead_status_idx" ON "ServiceLead"("status");

-- CreateIndex
CREATE INDEX "ServiceSurvey_leadId_idx" ON "ServiceSurvey"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAgreement_leadId_key" ON "ServiceAgreement"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_leadId_key" ON "Place"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_routeStopId_key" ON "Place"("routeStopId");

-- CreateIndex
CREATE INDEX "Place_status_idx" ON "Place"("status");

-- CreateIndex
CREATE INDEX "AuthorizedPickupPerson_studentId_active_idx" ON "AuthorizedPickupPerson"("studentId", "active");

-- CreateIndex
CREATE INDEX "RouteVersion_routeId_status_idx" ON "RouteVersion"("routeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RouteVersion_routeId_number_key" ON "RouteVersion"("routeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "RouteVersionStop_versionId_sequence_key" ON "RouteVersionStop"("versionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RouteVersionStop_versionId_routeStopId_key" ON "RouteVersionStop"("versionId", "routeStopId");

-- CreateIndex
CREATE INDEX "RouteImpact_routeId_createdAt_idx" ON "RouteImpact"("routeId", "createdAt");

-- CreateIndex
CREATE INDEX "RunStopSnapshot_runId_idx" ON "RunStopSnapshot"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunStopSnapshot_runId_sequence_key" ON "RunStopSnapshot"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceException_serviceDate_kind_key" ON "ServiceException"("serviceDate", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleInspection_idempotencyKey_key" ON "VehicleInspection"("idempotencyKey");

-- CreateIndex
CREATE INDEX "VehicleInspection_runId_kind_idx" ON "VehicleInspection"("runId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTripEvent_idempotencyKey_key" ON "StudentTripEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StudentTripEvent_runId_studentId_idx" ON "StudentTripEvent"("runId", "studentId");

-- AddForeignKey
ALTER TABLE "ServiceLead" ADD CONSTRAINT "ServiceLead_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLead" ADD CONSTRAINT "ServiceLead_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSurvey" ADD CONSTRAINT "ServiceSurvey_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ServiceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAgreement" ADD CONSTRAINT "ServiceAgreement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ServiceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ServiceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizedPickupPerson" ADD CONSTRAINT "AuthorizedPickupPerson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteVersion" ADD CONSTRAINT "RouteVersion_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteVersionStop" ADD CONSTRAINT "RouteVersionStop_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RouteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteImpact" ADD CONSTRAINT "RouteImpact_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteImpact" ADD CONSTRAINT "RouteImpact_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunStopSnapshot" ADD CONSTRAINT "RunStopSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScheduleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceException" ADD CONSTRAINT "ServiceException_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScheduleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep the fine-grained disposition aligned with statuses already stored.
UPDATE "StudentRunState" SET "disposition" = CASE "status"::text
  WHEN 'BOARDED' THEN 'BOARDED'::"TripDisposition"
  WHEN 'ALIGHTED' THEN 'DROPPED_OFF'::"TripDisposition"
  WHEN 'NO_SHOW' THEN 'NOT_PRESENT'::"TripDisposition"
  WHEN 'EXCUSED' THEN 'ABSENCE_CONFIRMED'::"TripDisposition"
  ELSE 'UNKNOWN'::"TripDisposition"
END;

CREATE INDEX "Place_geog_idx" ON "Place" USING GIST ("geog");

ALTER TABLE "StudentTripEvent" ADD CONSTRAINT "StudentTripEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScheduleRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTripEvent" ADD CONSTRAINT "StudentTripEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
