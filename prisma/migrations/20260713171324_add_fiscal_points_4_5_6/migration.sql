-- CreateEnum
CREATE TYPE "FiscalDocumentProvider" AS ENUM ('MOCK');

-- CreateEnum
CREATE TYPE "FiscalElectronicDocumentStatus" AS ENUM ('GENERATED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FiscalObligationRecurrence" AS ENUM ('MONTHLY', 'BIMONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "FiscalDocumentFileType" AS ENUM ('PDF', 'XML', 'OTHER');

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'FISCAL_OBLIGATION_DUE';

-- CreateTable
CREATE TABLE "FiscalElectronicDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalTransactionId" TEXT NOT NULL,
    "provider" "FiscalDocumentProvider" NOT NULL DEFAULT 'MOCK',
    "status" "FiscalElectronicDocumentStatus" NOT NULL,
    "externalDocumentId" TEXT,
    "validationCode" TEXT,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "issuedAt" TIMESTAMP(3),
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalElectronicDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalObligation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "recurrence" "FiscalObligationRecurrence" NOT NULL,
    "dueDayOfMonth" INTEGER NOT NULL,
    "dueMonth" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDocumentFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalTransactionId" TEXT NOT NULL,
    "fileType" "FiscalDocumentFileType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalDocumentFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalElectronicDocument_fiscalTransactionId_key" ON "FiscalElectronicDocument"("fiscalTransactionId");

-- CreateIndex
CREATE INDEX "FiscalObligation_companyId_isActive_idx" ON "FiscalObligation"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "FiscalDocumentFile_companyId_fiscalTransactionId_idx" ON "FiscalDocumentFile"("companyId", "fiscalTransactionId");

-- AddForeignKey
ALTER TABLE "FiscalElectronicDocument" ADD CONSTRAINT "FiscalElectronicDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalElectronicDocument" ADD CONSTRAINT "FiscalElectronicDocument_fiscalTransactionId_fkey" FOREIGN KEY ("fiscalTransactionId") REFERENCES "FiscalTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalElectronicDocument" ADD CONSTRAINT "FiscalElectronicDocument_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalObligation" ADD CONSTRAINT "FiscalObligation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalObligation" ADD CONSTRAINT "FiscalObligation_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentFile" ADD CONSTRAINT "FiscalDocumentFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentFile" ADD CONSTRAINT "FiscalDocumentFile_fiscalTransactionId_fkey" FOREIGN KEY ("fiscalTransactionId") REFERENCES "FiscalTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocumentFile" ADD CONSTRAINT "FiscalDocumentFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
