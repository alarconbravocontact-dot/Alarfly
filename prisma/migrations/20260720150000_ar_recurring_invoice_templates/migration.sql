-- CreateTable
CREATE TABLE "ArRecurringInvoiceTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "incomeAccountId" TEXT NOT NULL,
    "taxRateId" TEXT,
    "withholdingRateId" TEXT,
    "linesSnapshot" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArRecurringInvoiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArRecurringInvoiceTemplate_companyId_isActive_idx" ON "ArRecurringInvoiceTemplate"("companyId", "isActive");

-- AddForeignKey
ALTER TABLE "ArRecurringInvoiceTemplate" ADD CONSTRAINT "ArRecurringInvoiceTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArRecurringInvoiceTemplate" ADD CONSTRAINT "ArRecurringInvoiceTemplate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArRecurringInvoiceTemplate" ADD CONSTRAINT "ArRecurringInvoiceTemplate_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArRecurringInvoiceTemplate" ADD CONSTRAINT "ArRecurringInvoiceTemplate_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArRecurringInvoiceTemplate" ADD CONSTRAINT "ArRecurringInvoiceTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

