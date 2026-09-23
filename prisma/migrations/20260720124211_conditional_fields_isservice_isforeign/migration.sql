-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "billingCurrency" TEXT,
ADD COLUMN     "isForeign" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isService" BOOLEAN NOT NULL DEFAULT false;

