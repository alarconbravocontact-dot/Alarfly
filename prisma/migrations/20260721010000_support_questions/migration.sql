-- CreateTable
CREATE TABLE "SupportQuestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "matchedArticleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportQuestion_companyId_userId_moduleKey_idx" ON "SupportQuestion"("companyId", "userId", "moduleKey");

-- AddForeignKey
ALTER TABLE "SupportQuestion" ADD CONSTRAINT "SupportQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportQuestion" ADD CONSTRAINT "SupportQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

