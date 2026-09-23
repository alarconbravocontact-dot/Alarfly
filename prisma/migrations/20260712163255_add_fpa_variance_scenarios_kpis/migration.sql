-- CreateTable
CREATE TABLE "FpaSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "varianceThresholdPercentage" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FpaSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetVarianceJustification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "budgetedAmount" DECIMAL(18,2) NOT NULL,
    "actualAmount" DECIMAL(18,2) NOT NULL,
    "variancePercentage" DECIMAL(7,2) NOT NULL,
    "comment" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetVarianceJustification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatIfScenario" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parameters" JSONB NOT NULL,
    "projectedResult" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatIfScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FpaSettings_companyId_key" ON "FpaSettings"("companyId");

-- CreateIndex
CREATE INDEX "BudgetVarianceJustification_budgetLineId_createdAt_idx" ON "BudgetVarianceJustification"("budgetLineId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatIfScenario_companyId_idx" ON "WhatIfScenario"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiDefinition_companyId_name_key" ON "KpiDefinition"("companyId", "name");

-- AddForeignKey
ALTER TABLE "FpaSettings" ADD CONSTRAINT "FpaSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetVarianceJustification" ADD CONSTRAINT "BudgetVarianceJustification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetVarianceJustification" ADD CONSTRAINT "BudgetVarianceJustification_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetVarianceJustification" ADD CONSTRAINT "BudgetVarianceJustification_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatIfScenario" ADD CONSTRAINT "WhatIfScenario_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatIfScenario" ADD CONSTRAINT "WhatIfScenario_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiDefinition" ADD CONSTRAINT "KpiDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
