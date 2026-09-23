-- CreateTable
CREATE TABLE "PinnedItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3),
    "visitCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PinnedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PinnedItem_companyId_userId_idx" ON "PinnedItem"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PinnedItem_userId_path_key" ON "PinnedItem"("userId", "path");

-- AddForeignKey
ALTER TABLE "PinnedItem" ADD CONSTRAINT "PinnedItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinnedItem" ADD CONSTRAINT "PinnedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

