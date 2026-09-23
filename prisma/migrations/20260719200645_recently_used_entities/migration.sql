-- CreateTable
CREATE TABLE "RecentlyUsedEntity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentlyUsedEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecentlyUsedEntity_companyId_userId_entityType_lastUsedAt_idx" ON "RecentlyUsedEntity"("companyId", "userId", "entityType", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentlyUsedEntity_userId_entityType_entityId_key" ON "RecentlyUsedEntity"("userId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "RecentlyUsedEntity" ADD CONSTRAINT "RecentlyUsedEntity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentlyUsedEntity" ADD CONSTRAINT "RecentlyUsedEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

