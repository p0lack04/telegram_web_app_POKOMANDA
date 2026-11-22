-- Preserve existing metadata. Tombstones allow safe, repeatable external deletion.
ALTER TABLE "BankEventFile" ADD COLUMN "requestKey" TEXT;
ALTER TABLE "BankEventFile" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "BankEventFile" ADD COLUMN "storageDeletedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "BankEventFile_requestKey_key" ON "BankEventFile"("requestKey");
ALTER TABLE "BankEventFile" ADD CONSTRAINT "File_scan_status_check" CHECK ("scanStatus" IN ('PENDING','CLEAN','INFECTED','ERROR')) NOT VALID;
ALTER TABLE "BankEventFile" VALIDATE CONSTRAINT "File_scan_status_check";
