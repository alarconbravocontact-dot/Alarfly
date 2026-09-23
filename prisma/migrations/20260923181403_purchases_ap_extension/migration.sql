-- CreateEnum
CREATE TYPE "ApCreditNoteType" AS ENUM ('CREDIT', 'DEBIT');

-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'VENDOR_RETURN_EXIT';

-- AlterTable
ALTER TABLE "ApBillLine" ADD COLUMN     "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "productVariantId" TEXT,
ADD COLUMN     "purchaseOrderLineId" TEXT,
ADD COLUMN     "unitCost" DECIMAL(18,6),
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "ApPayment" ADD COLUMN     "exchangeRate" DECIMAL(18,6),
ADD COLUMN     "foreignAmount" DECIMAL(18,4),
ADD COLUMN     "foreignCurrency" TEXT,
ADD COLUMN     "paymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "ArApSettings" ADD COLUMN     "currentApCreditNoteNumberSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "purchaseOrderLineId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "receivedCostTotal" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ApCreditNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "noteNumber" INTEGER NOT NULL,
    "type" "ApCreditNoteType" NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "relatedInventoryMovementId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApCreditNote_relatedInventoryMovementId_key" ON "ApCreditNote"("relatedInventoryMovementId");

-- CreateIndex
CREATE INDEX "ApCreditNote_companyId_vendorId_idx" ON "ApCreditNote"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "ApCreditNote_companyId_billId_idx" ON "ApCreditNote"("companyId", "billId");

-- CreateIndex
CREATE UNIQUE INDEX "ApCreditNote_companyId_noteNumber_key" ON "ApCreditNote"("companyId", "noteNumber");

-- CreateIndex
CREATE INDEX "InventoryMovement_purchaseOrderLineId_idx" ON "InventoryMovement"("purchaseOrderLineId");

-- AddForeignKey
ALTER TABLE "ApBillLine" ADD CONSTRAINT "ApBillLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBillLine" ADD CONSTRAINT "ApBillLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApBillLine" ADD CONSTRAINT "ApBillLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApPayment" ADD CONSTRAINT "ApPayment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApCreditNote" ADD CONSTRAINT "ApCreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApCreditNote" ADD CONSTRAINT "ApCreditNote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApCreditNote" ADD CONSTRAINT "ApCreditNote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "ApBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApCreditNote" ADD CONSTRAINT "ApCreditNote_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApCreditNote" ADD CONSTRAINT "ApCreditNote_relatedInventoryMovementId_fkey" FOREIGN KEY ("relatedInventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApCreditNote" ADD CONSTRAINT "ApCreditNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

