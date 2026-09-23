-- CreateEnum
CREATE TYPE "FpaDimensionType" AS ENUM ('DEPARTMENT', 'BUSINESS_LINE', 'COST_CENTER', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetVersionType" AS ENUM ('ORIGINAL', 'REFORECAST');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "BudgetAmountType" AS ENUM ('FIXED', 'FORMULA');

-- CreateTable
CREATE TABLE "FpaDimension" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "FpaDimensionType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "FpaDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryLineFpaDimension" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "fpaDimensionId" TEXT NOT NULL,

    CONSTRAINT "JournalEntryLineFpaDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "versionType" "BudgetVersionType" NOT NULL DEFAULT 'ORIGINAL',
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "previousVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fpaDimensionId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "amountType" "BudgetAmountType" NOT NULL DEFAULT 'FIXED',
    "amount" DECIMAL(18,2),
    "formula" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FpaDimension_companyId_type_idx" ON "FpaDimension"("companyId", "type");

-- CreateIndex
CREATE INDEX "FpaDimension_companyId_parentId_idx" ON "FpaDimension"("companyId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntryLineFpaDimension_lineId_fpaDimensionId_key" ON "JournalEntryLineFpaDimension"("lineId", "fpaDimensionId");

-- CreateIndex
CREATE INDEX "Budget_companyId_fiscalYear_status_idx" ON "Budget"("companyId", "fiscalYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_companyId_fiscalYear_versionNumber_key" ON "Budget"("companyId", "fiscalYear", "versionNumber");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_budgetId_accountId_fpaDimensionId_period_key" ON "BudgetLine"("budgetId", "accountId", "fpaDimensionId", "period");

-- AddForeignKey
ALTER TABLE "FpaDimension" ADD CONSTRAINT "FpaDimension_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpaDimension" ADD CONSTRAINT "FpaDimension_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FpaDimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLineFpaDimension" ADD CONSTRAINT "JournalEntryLineFpaDimension_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "JournalEntryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLineFpaDimension" ADD CONSTRAINT "JournalEntryLineFpaDimension_fpaDimensionId_fkey" FOREIGN KEY ("fpaDimensionId") REFERENCES "FpaDimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_fpaDimensionId_fkey" FOREIGN KEY ("fpaDimensionId") REFERENCES "FpaDimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
