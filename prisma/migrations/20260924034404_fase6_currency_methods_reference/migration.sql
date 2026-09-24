-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('BCV', 'MANUAL');

-- AlterTable
ALTER TABLE "ApPayment" ADD COLUMN     "bankTransactionId" TEXT,
ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "ArPayment" ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "ExchangeRate" ADD COLUMN     "source" "ExchangeRateSource" NOT NULL DEFAULT 'BCV';

-- CreateIndex
CREATE UNIQUE INDEX "ApPayment_bankTransactionId_key" ON "ApPayment"("bankTransactionId");

-- AddForeignKey
ALTER TABLE "ApPayment" ADD CONSTRAINT "ApPayment_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

