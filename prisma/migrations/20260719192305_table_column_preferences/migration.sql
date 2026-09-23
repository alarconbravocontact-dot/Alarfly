-- CreateTable
CREATE TABLE "TableColumnPreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "columnKey" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "width" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableColumnPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableColumnPreference_companyId_tableKey_idx" ON "TableColumnPreference"("companyId", "tableKey");

-- CreateIndex
CREATE UNIQUE INDEX "TableColumnPreference_userId_tableKey_columnKey_key" ON "TableColumnPreference"("userId", "tableKey", "columnKey");

-- AddForeignKey
ALTER TABLE "TableColumnPreference" ADD CONSTRAINT "TableColumnPreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableColumnPreference" ADD CONSTRAINT "TableColumnPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

