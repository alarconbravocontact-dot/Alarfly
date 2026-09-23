-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "defaultDateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "defaultLanguage" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN     "defaultTimeZone" TEXT;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "timeZone" TEXT,
ALTER COLUMN "dateFormat" DROP NOT NULL,
ALTER COLUMN "dateFormat" DROP DEFAULT,
ALTER COLUMN "language" DROP NOT NULL,
ALTER COLUMN "language" DROP DEFAULT;

