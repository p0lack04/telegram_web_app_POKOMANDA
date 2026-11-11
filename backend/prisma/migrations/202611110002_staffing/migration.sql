-- Аддитивная миграция: существующие заявки получают version=0.
ALTER TABLE "Application" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD CONSTRAINT "Application_version_check" CHECK ("version" >= 0);
CREATE INDEX "Application_userId_createdAt_idx" ON "Application"("userId", "createdAt");
CREATE INDEX "ShiftRole_userId_createdAt_idx" ON "ShiftRole"("userId", "createdAt");
CREATE INDEX "AuditLog_shiftId_action_createdAt_idx" ON "AuditLog"("shiftId", "action", "createdAt");
