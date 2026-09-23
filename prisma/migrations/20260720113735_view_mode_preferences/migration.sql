-- CreateTable
CREATE TABLE "ViewModePreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'LIST',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewModePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ViewModePreference_companyId_viewKey_idx" ON "ViewModePreference"("companyId", "viewKey");

-- CreateIndex
CREATE UNIQUE INDEX "ViewModePreference_userId_viewKey_key" ON "ViewModePreference"("userId", "viewKey");

-- AddForeignKey
ALTER TABLE "ViewModePreference" ADD CONSTRAINT "ViewModePreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewModePreference" ADD CONSTRAINT "ViewModePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

