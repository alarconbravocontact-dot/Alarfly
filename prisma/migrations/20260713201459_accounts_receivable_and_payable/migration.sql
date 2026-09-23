-- CreateEnum
CREATE TYPE "ArInvoiceStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApBillStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "incomeAccountId" TEXT NOT NULL,
    "fiscalTransactionId" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ArInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArPaymentApplication" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ArPaymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApBill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billNumber" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "expenseAccountId" TEXT NOT NULL,
    "fiscalTransactionId" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withholdingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ApBillStatus" NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApPaymentApplication" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ApPaymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArApSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "receivableGlAccountId" TEXT,
    "payableGlAccountId" TEXT,
    "currentArInvoiceNumberSequence" INTEGER NOT NULL DEFAULT 0,
    "currentApBillNumberSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArApSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_companyId_isActive_idx" ON "Customer"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_name_key" ON "Customer"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ArInvoice_fiscalTransactionId_key" ON "ArInvoice"("fiscalTransactionId");

-- CreateIndex
CREATE INDEX "ArInvoice_companyId_customerId_status_idx" ON "ArInvoice"("companyId", "customerId", "status");

-- CreateIndex
CREATE INDEX "ArInvoice_companyId_dueDate_idx" ON "ArInvoice"("companyId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ArInvoice_companyId_invoiceNumber_key" ON "ArInvoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "ArPayment_companyId_customerId_idx" ON "ArPayment"("companyId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ArPaymentApplication_paymentId_invoiceId_key" ON "ArPaymentApplication"("paymentId", "invoiceId");

-- CreateIndex
CREATE INDEX "Vendor_companyId_isActive_idx" ON "Vendor"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_companyId_name_key" ON "Vendor"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ApBill_fiscalTransactionId_key" ON "ApBill"("fiscalTransactionId");

-- CreateIndex
CREATE INDEX "ApBill_companyId_vendorId_status_idx" ON "ApBill"("companyId", "vendorId", "status");

-- CreateIndex
CREATE INDEX "ApBill_companyId_dueDate_idx" ON "ApBill"("companyId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ApBill_companyId_billNumber_key" ON "ApBill"("companyId", "billNumber");

-- CreateIndex
CREATE INDEX "ApPayment_companyId_vendorId_idx" ON "ApPayment"("companyId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "ApPaymentApplication_paymentId_billId_key" ON "ApPaymentApplication"("paymentId", "billId");

-- CreateIndex
CREATE UNIQUE INDEX "ArApSettings_companyId_key" ON "ArApSettings"("companyId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_fiscalTransactionId_fkey" FOREIGN KEY ("fiscalTransactionId") REFERENCES "FiscalTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoiceLine" ADD CONSTRAINT "ArInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ArInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPayment" ADD CONSTRAINT "ArPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPayment" ADD CONSTRAINT "ArPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPayment" ADD CONSTRAINT "ArPayment_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPayment" ADD CONSTRAINT "ArPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPayment" ADD CONSTRAINT "ArPayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPaymentApplication" ADD CONSTRAINT "ArPaymentApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ArPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArPaymentApplication" ADD CONSTRAINT "ArPaymentApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ArInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBill" ADD CONSTRAINT "ApBill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBill" ADD CONSTRAINT "ApBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBill" ADD CONSTRAINT "ApBill_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBill" ADD CONSTRAINT "ApBill_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBill" ADD CONSTRAINT "ApBill_fiscalTransactionId_fkey" FOREIGN KEY ("fiscalTransactionId") REFERENCES "FiscalTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBill" ADD CONSTRAINT "ApBill_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBillLine" ADD CONSTRAINT "ApBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "ApBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApPayment" ADD CONSTRAINT "ApPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApPayment" ADD CONSTRAINT "ApPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApPayment" ADD CONSTRAINT "ApPayment_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApPayment" ADD CONSTRAINT "ApPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApPayment" ADD CONSTRAINT "ApPayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApPaymentApplication" ADD CONSTRAINT "ApPaymentApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ApPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApPaymentApplication" ADD CONSTRAINT "ApPaymentApplication_billId_fkey" FOREIGN KEY ("billId") REFERENCES "ApBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArApSettings" ADD CONSTRAINT "ArApSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArApSettings" ADD CONSTRAINT "ArApSettings_receivableGlAccountId_fkey" FOREIGN KEY ("receivableGlAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArApSettings" ADD CONSTRAINT "ArApSettings_payableGlAccountId_fkey" FOREIGN KEY ("payableGlAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
