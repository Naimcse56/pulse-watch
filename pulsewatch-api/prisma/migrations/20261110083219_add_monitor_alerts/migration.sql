-- CreateEnum
CREATE TYPE "MonitorAlertType" AS ENUM ('DOWN', 'RECOVERED');

-- CreateTable
CREATE TABLE "MonitorAlert" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "type" "MonitorAlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitorAlert_monitorId_createdAt_idx" ON "MonitorAlert"("monitorId", "createdAt");

-- CreateIndex
CREATE INDEX "MonitorAlert_type_createdAt_idx" ON "MonitorAlert"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
