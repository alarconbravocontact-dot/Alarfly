-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('VAT', 'WITHHOLDING', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxApplicability" AS ENUM ('SALE', 'PURCHASE', 'BOTH');

-- CreateEnum
CREATE TYPE "FiscalTransactionType" AS ENUM ('SALE', 'PURCHASE');

-- CreateEnum
CREATE TYPE "FiscalRiskSeverity" AS ENUM ('WARNING', 'BLOCKING');

-- CreateTable
CREATE TABLE "TaxJurisdiction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxJurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "type" "TaxType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL,
    "appliesTo" "TaxApplicability" NOT NULL DEFAULT 'BOTH',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "glAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "FiscalTransactionType" NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "counterpartyName" TEXT NOT NULL,
    "counterpartyTaxId" TEXT NOT NULL,
    "documentNumber" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "taxBase" DECIMAL(18,2) NOT NULL,
    "taxRateId" TEXT,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingRateId" TEXT,
    "withholdingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalRiskRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "condition" JSONB NOT NULL,
    "severity" "FiscalRiskSeverity" NOT NULL DEFAULT 'WARNING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalRiskRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalRiskAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "fiscalTransactionId" TEXT NOT NULL,
    "severity" "FiscalRiskSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "wasBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalRiskAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxJurisdiction_companyId_code_key" ON "TaxJurisdiction"("companyId", "code");

-- CreateIndex
CREATE INDEX "TaxRate_companyId_jurisdictionId_type_appliesTo_idx" ON "TaxRate"("companyId", "jurisdictionId", "type", "appliesTo");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalTransaction_journalEntryId_key" ON "FiscalTransaction"("journalEntryId");

-- CreateIndex
CREATE INDEX "FiscalTransaction_companyId_type_date_idx" ON "FiscalTransaction"("companyId", "type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalRiskRule_companyId_name_key" ON "FiscalRiskRule"("companyId", "name");

-- CreateIndex
CREATE INDEX "FiscalRiskAlert_companyId_createdAt_idx" ON "FiscalRiskAlert"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaxJurisdiction" ADD CONSTRAINT "TaxJurisdiction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransaction" ADD CONSTRAINT "FiscalTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransaction" ADD CONSTRAINT "FiscalTransaction_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransaction" ADD CONSTRAINT "FiscalTransaction_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransaction" ADD CONSTRAINT "FiscalTransaction_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransaction" ADD CONSTRAINT "FiscalTransaction_withholdingRateId_fkey" FOREIGN KEY ("withholdingRateId") REFERENCES "TaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalTransaction" ADD CONSTRAINT "FiscalTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalRiskRule" ADD CONSTRAINT "FiscalRiskRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalRiskAlert" ADD CONSTRAINT "FiscalRiskAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalRiskAlert" ADD CONSTRAINT "FiscalRiskAlert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "FiscalRiskRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalRiskAlert" ADD CONSTRAINT "FiscalRiskAlert_fiscalTransactionId_fkey" FOREIGN KEY ("fiscalTransactionId") REFERENCES "FiscalTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
