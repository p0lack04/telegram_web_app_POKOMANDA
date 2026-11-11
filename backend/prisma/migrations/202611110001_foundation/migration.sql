-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LEAD', 'TRAINEE');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('ADMIN_ONLY', 'ADMIN_LEAD', 'ADMIN_LEAD_TRAINEE');

-- CreateEnum
CREATE TYPE "ShiftStage" AS ENUM ('STAGE_1', 'STAGE_2', 'STAGE_3', 'STAGE_4');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('LEAD_RECRUIT', 'TRAINEE_RECRUIT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('LEAD', 'TRAINEE', 'CHILD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "DailyMarkType" AS ENUM ('FULL_DAY', 'TECHNIC');

-- CreateEnum
CREATE TYPE "BankCategory" AS ENUM ('FIVE_MIN', 'ICEBREAKER', 'EDUCATIONAL', 'ENTERTAINMENT');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('DOCUMENT', 'MEDIA');

-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('EDUCATIONAL', 'ENTERTAINMENT');

-- CreateEnum
CREATE TYPE "TechPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TechStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SurveyType" AS ENUM ('DAILY', 'GENERAL');

-- CreateEnum
CREATE TYPE "SurveyAudience" AS ENUM ('LEADS', 'TRAINEES', 'ALL');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'CHOICE', 'MULTIPLE_CHOICE', 'RATING', 'SCALE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "middleName" TEXT,
    "phone" TEXT,
    "birthDate" DATE,
    "role" "Role" NOT NULL DEFAULT 'TRAINEE',
    "firstShiftDate" DATE,
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "creativeTaskUrl" TEXT,
    "presentationUrl" TEXT,
    "manualShiftsCount" INTEGER NOT NULL DEFAULT 0,
    "manualExperience" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramReplay" (
    "digest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramReplay_pkey" PRIMARY KEY ("digest")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "visibility" "Visibility" NOT NULL DEFAULT 'ADMIN_ONLY',
    "stage" "ShiftStage" NOT NULL DEFAULT 'STAGE_1',
    "googleSheetId" TEXT,
    "leadRecruitOpen" BOOLEAN NOT NULL DEFAULT false,
    "traineeRecruitOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ApplicationType" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#28634a',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMember" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "birthDate" DATE,
    "memberType" "MemberType" NOT NULL,
    "building" TEXT,
    "room" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentNote" TEXT,
    "checkinStatus" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftRole" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "squadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMark" (
    "id" TEXT NOT NULL,
    "squadMemberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "markType" "DailyMarkType" NOT NULL,
    "note" TEXT,
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankEvent" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "BankCategory" NOT NULL,
    "ageGroup" TEXT,
    "duration" INTEGER,
    "materials" TEXT,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankEventFile" (
    "id" TEXT NOT NULL,
    "bankEventId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "fileType" "FileCategory" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankEventFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramItem" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    "type" "ProgramType" NOT NULL,
    "responsibleId" TEXT,
    "bankEventId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechRequest" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "programItemId" TEXT,
    "authorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TechPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TechStatus" NOT NULL DEFAULT 'PENDING',
    "responsibleId" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "surveyType" "SurveyType" NOT NULL,
    "targetDate" DATE,
    "audience" "SurveyAudience" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "options" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveySubmission" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "answerText" TEXT,
    "answerValue" INTEGER,
    "answerOptions" TEXT[],

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issueDate" DATE,
    "expiryDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineeComment" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraineeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionComment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Knowledge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "BankCategory",
    "kind" TEXT NOT NULL DEFAULT 'METHODICAL',
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramProposal" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "telegramOptIn" BOOLEAN NOT NULL DEFAULT false,
    "programAlerts" BOOLEAN NOT NULL DEFAULT true,
    "surveyAlerts" BOOLEAN NOT NULL DEFAULT true,
    "techAlerts" BOOLEAN NOT NULL DEFAULT true,
    "newShiftAlerts" BOOLEAN NOT NULL DEFAULT true,
    "leadDocAlerts" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "shiftId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "preview" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_accountStatus_isOnboarded_createdAt_idx" ON "User"("accountStatus", "isOnboarded", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "TelegramReplay_expiresAt_idx" ON "TelegramReplay"("expiresAt");

-- CreateIndex
CREATE INDEX "Shift_visibility_startDate_idx" ON "Shift"("visibility", "startDate");

-- CreateIndex
CREATE INDEX "Application_userId_idx" ON "Application"("userId");

-- CreateIndex
CREATE INDEX "Application_shiftId_type_status_idx" ON "Application"("shiftId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_shiftId_userId_type_key" ON "Application"("shiftId", "userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_id_shiftId_key" ON "Squad"("id", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_shiftId_name_key" ON "Squad"("shiftId", "name");

-- CreateIndex
CREATE INDEX "SquadMember_shiftId_memberType_idx" ON "SquadMember"("shiftId", "memberType");

-- CreateIndex
CREATE INDEX "SquadMember_userId_idx" ON "SquadMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMember_squadId_userId_key" ON "SquadMember"("squadId", "userId");

-- CreateIndex
CREATE INDEX "ShiftRole_userId_idx" ON "ShiftRole"("userId");

-- CreateIndex
CREATE INDEX "ShiftRole_squadId_shiftId_idx" ON "ShiftRole"("squadId", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRole_shiftId_userId_position_key" ON "ShiftRole"("shiftId", "userId", "position");

-- CreateIndex
CREATE INDEX "DailyMark_setById_idx" ON "DailyMark"("setById");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMark_squadMemberId_date_key" ON "DailyMark"("squadMemberId", "date");

-- CreateIndex
CREATE INDEX "BankEvent_category_isPublic_createdAt_idx" ON "BankEvent"("category", "isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "BankEvent_authorId_idx" ON "BankEvent"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "BankEventFile_storageKey_key" ON "BankEventFile"("storageKey");

-- CreateIndex
CREATE INDEX "BankEventFile_bankEventId_idx" ON "BankEventFile"("bankEventId");

-- CreateIndex
CREATE INDEX "BankEventFile_uploadedById_idx" ON "BankEventFile"("uploadedById");

-- CreateIndex
CREATE INDEX "ProgramItem_shiftId_date_sortOrder_idx" ON "ProgramItem"("shiftId", "date", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramItem_responsibleId_idx" ON "ProgramItem"("responsibleId");

-- CreateIndex
CREATE INDEX "ProgramItem_bankEventId_idx" ON "ProgramItem"("bankEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramItem_id_shiftId_key" ON "ProgramItem"("id", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "TechRequest_programItemId_key" ON "TechRequest"("programItemId");

-- CreateIndex
CREATE INDEX "TechRequest_shiftId_status_priority_idx" ON "TechRequest"("shiftId", "status", "priority");

-- CreateIndex
CREATE INDEX "TechRequest_responsibleId_idx" ON "TechRequest"("responsibleId");

-- CreateIndex
CREATE INDEX "TechRequest_authorId_idx" ON "TechRequest"("authorId");

-- CreateIndex
CREATE INDEX "TechRequest_assignedById_idx" ON "TechRequest"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "TechRequest_programItemId_shiftId_key" ON "TechRequest"("programItemId", "shiftId");

-- CreateIndex
CREATE INDEX "Survey_shiftId_isActive_idx" ON "Survey"("shiftId", "isActive");

-- CreateIndex
CREATE INDEX "Survey_createdById_idx" ON "Survey"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestion_id_surveyId_key" ON "SurveyQuestion"("id", "surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestion_surveyId_sortOrder_key" ON "SurveyQuestion"("surveyId", "sortOrder");

-- CreateIndex
CREATE INDEX "SurveySubmission_userId_idx" ON "SurveySubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveySubmission_surveyId_userId_key" ON "SurveySubmission"("surveyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveySubmission_id_surveyId_key" ON "SurveySubmission"("id", "surveyId");

-- CreateIndex
CREATE INDEX "SurveyAnswer_questionId_surveyId_idx" ON "SurveyAnswer"("questionId", "surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyAnswer_submissionId_questionId_key" ON "SurveyAnswer"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "UserDocument_userId_idx" ON "UserDocument"("userId");

-- CreateIndex
CREATE INDEX "UserDocument_expiryDate_idx" ON "UserDocument"("expiryDate");

-- CreateIndex
CREATE INDEX "TraineeComment_traineeId_createdAt_idx" ON "TraineeComment"("traineeId", "createdAt");

-- CreateIndex
CREATE INDEX "TraineeComment_authorId_idx" ON "TraineeComment"("authorId");

-- CreateIndex
CREATE INDEX "SelectionComment_shiftId_candidateId_createdAt_idx" ON "SelectionComment"("shiftId", "candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "SelectionComment_authorId_idx" ON "SelectionComment"("authorId");

-- CreateIndex
CREATE INDEX "Knowledge_category_idx" ON "Knowledge"("category");

-- CreateIndex
CREATE INDEX "Knowledge_authorId_idx" ON "Knowledge"("authorId");

-- CreateIndex
CREATE INDEX "ProgramProposal_shiftId_status_idx" ON "ProgramProposal"("shiftId", "status");

-- CreateIndex
CREATE INDEX "ProgramProposal_authorId_idx" ON "ProgramProposal"("authorId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Outbox_dedupeKey_key" ON "Outbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "Outbox_sentAt_availableAt_idx" ON "Outbox"("sentAt", "availableAt");

-- CreateIndex
CREATE INDEX "Outbox_userId_idx" ON "Outbox"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_shiftId_createdAt_idx" ON "AuditLog"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "ImportJob_actorId_expiresAt_idx" ON "ImportJob"("actorId", "expiresAt");

-- CreateIndex
CREATE INDEX "ImportJob_shiftId_idx" ON "ImportJob"("shiftId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_squadId_shiftId_fkey" FOREIGN KEY ("squadId", "shiftId") REFERENCES "Squad"("id", "shiftId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRole" ADD CONSTRAINT "ShiftRole_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRole" ADD CONSTRAINT "ShiftRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRole" ADD CONSTRAINT "ShiftRole_squadId_shiftId_fkey" FOREIGN KEY ("squadId", "shiftId") REFERENCES "Squad"("id", "shiftId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMark" ADD CONSTRAINT "DailyMark_squadMemberId_fkey" FOREIGN KEY ("squadMemberId") REFERENCES "SquadMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMark" ADD CONSTRAINT "DailyMark_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankEvent" ADD CONSTRAINT "BankEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankEventFile" ADD CONSTRAINT "BankEventFile_bankEventId_fkey" FOREIGN KEY ("bankEventId") REFERENCES "BankEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankEventFile" ADD CONSTRAINT "BankEventFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramItem" ADD CONSTRAINT "ProgramItem_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramItem" ADD CONSTRAINT "ProgramItem_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramItem" ADD CONSTRAINT "ProgramItem_bankEventId_fkey" FOREIGN KEY ("bankEventId") REFERENCES "BankEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechRequest" ADD CONSTRAINT "TechRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechRequest" ADD CONSTRAINT "TechRequest_programItemId_shiftId_fkey" FOREIGN KEY ("programItemId", "shiftId") REFERENCES "ProgramItem"("id", "shiftId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechRequest" ADD CONSTRAINT "TechRequest_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechRequest" ADD CONSTRAINT "TechRequest_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechRequest" ADD CONSTRAINT "TechRequest_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveySubmission" ADD CONSTRAINT "SurveySubmission_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveySubmission" ADD CONSTRAINT "SurveySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_surveyId_fkey" FOREIGN KEY ("questionId", "surveyId") REFERENCES "SurveyQuestion"("id", "surveyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_submissionId_surveyId_fkey" FOREIGN KEY ("submissionId", "surveyId") REFERENCES "SurveySubmission"("id", "surveyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeComment" ADD CONSTRAINT "TraineeComment_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeComment" ADD CONSTRAINT "TraineeComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionComment" ADD CONSTRAINT "SelectionComment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionComment" ADD CONSTRAINT "SelectionComment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionComment" ADD CONSTRAINT "SelectionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knowledge" ADD CONSTRAINT "Knowledge_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramProposal" ADD CONSTRAINT "ProgramProposal_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramProposal" ADD CONSTRAINT "ProgramProposal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Доменная целостность дополняет Prisma FK и уникальные ограничения.
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_dates_check" CHECK ("endDate" >= "startDate");
ALTER TABLE "User" ADD CONSTRAINT "User_manual_count_check" CHECK ("manualShiftsCount" >= 0);
ALTER TABLE "SquadMember" ADD CONSTRAINT "Member_identity_check" CHECK (("memberType" = 'CHILD' AND "userId" IS NULL) OR ("memberType" <> 'CHILD' AND "userId" IS NOT NULL));
ALTER TABLE "SquadMember" ADD CONSTRAINT "Partial_payment_note_check" CHECK ("paymentStatus" <> 'PARTIAL' OR length(trim(coalesce("paymentNote",''))) > 0);
ALTER TABLE "BankEventFile" ADD CONSTRAINT "File_size_check" CHECK ("fileSize" > 0 AND (("fileType" = 'DOCUMENT' AND "fileSize" <= 20971520) OR ("fileType" = 'MEDIA' AND "fileSize" <= 52428800)));
ALTER TABLE "BankEvent" ADD CONSTRAINT "Bank_duration_check" CHECK ("duration" IS NULL OR "duration" > 0);
ALTER TABLE "ProgramItem" ADD CONSTRAINT "Program_time_check" CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "endTime" > "startTime");
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_date_check" CHECK (("surveyType" = 'DAILY' AND "targetDate" IS NOT NULL) OR ("surveyType" = 'GENERAL' AND "targetDate" IS NULL));

