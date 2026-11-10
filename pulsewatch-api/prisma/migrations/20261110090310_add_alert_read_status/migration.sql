-- AlterTable
ALTER TABLE "MonitorAlert" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MonitorAlert_isRead_createdAt_idx" ON "MonitorAlert"("isRead", "createdAt");
