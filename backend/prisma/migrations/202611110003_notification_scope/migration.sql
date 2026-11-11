-- Без удаления существующих уведомлений. Старые STAFFING без scope не выдаются API:
-- связывать их по тексту небезопасно, автоматический backfill не выполняется.
ALTER TABLE "Notification" ADD COLUMN "shiftId" TEXT;
CREATE INDEX "Notification_shiftId_idx" ON "Notification"("shiftId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
