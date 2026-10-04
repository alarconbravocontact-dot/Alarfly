-- CreateEnum
CREATE TYPE "ContactMessageCategory" AS ENUM ('GENERAL', 'SUGGESTION', 'COMMENT', 'IMPROVEMENT', 'BUG_REPORT');

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "category" "ContactMessageCategory" NOT NULL DEFAULT 'GENERAL';
