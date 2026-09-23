-- CreateEnum
CREATE TYPE "ArCreditNoteType" AS ENUM ('CREDIT', 'DEBIT');

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'AR_COLLECTION_ESCALATION';

-- AlterTable
ALTER TABLE "ArApSettings" ADD COLUMN     "currentArCreditNoteNumberSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ArPayment" ADD COLUMN     "bankTransactionId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(18,2),
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxOverdueDaysAllowed" INTEGER;

-- CreateTable
CREATE TABLE "ArCreditNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "noteNumber" INTEGER NOT NULL,
    "type" "ArCreditNoteType" NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArCreditNote_companyId_customerId_idx" ON "ArCreditNote"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "ArCreditNote_companyId_invoiceId_idx" ON "ArCreditNote"("companyId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ArCreditNote_companyId_noteNumber_key" ON "ArCreditNote"("companyId", "noteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ArPayment_bankTransactionId_key" ON "ArPayment"("bankTransactionId");

-- AddForeignKey
ALTER TABLE "ArPayment" ADD CONSTRAINT "ArPayment_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArCreditNote" ADD CONSTRAINT "ArCreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArCreditNote" ADD CONSTRAINT "ArCreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArCreditNote" ADD CONSTRAINT "ArCreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ArInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArCreditNote" ADD CONSTRAINT "ArCreditNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArCreditNote" ADD CONSTRAINT "ArCreditNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

