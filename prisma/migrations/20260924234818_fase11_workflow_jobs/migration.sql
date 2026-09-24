-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('SUCCESS', 'ERROR');

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'APPROVAL_PENDING';

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_companyId_jobKey_startedAt_idx" ON "JobRun"("companyId", "jobKey", "startedAt");

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
