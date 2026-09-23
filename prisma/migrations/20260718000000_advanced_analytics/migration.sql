-- CreateEnum
CREATE TYPE "AdvancedAnalysisType" AS ENUM ('VERTICAL', 'HORIZONTAL', 'FINANCIAL_RATIOS', 'CASH_FLOW', 'BREAK_EVEN', 'CVU', 'WORKING_CAPITAL', 'PROFITABILITY_SEGMENT', 'BUDGET_VS_ACTUAL', 'DUPONT', 'TREND_ANALYSIS', 'WHAT_IF_SCENARIO', 'INVESTMENT_EVALUATION', 'FINANCIAL_RISK_LEVERAGE', 'BENCHMARKING', 'PREDICTIVE_FORECAST');

-- CreateEnum
CREATE TYPE "AnalysisChartType" AS ENUM ('TREND_LINE', 'COMPOSITION', 'COMPARISON');

-- CreateEnum
CREATE TYPE "AnalysisFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AnalysisTriggerSource" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "CostBehavior" AS ENUM ('FIXED', 'VARIABLE');

-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'ADVANCED_ANALYSIS_ALERT';

-- CreateTable
CREATE TABLE "AnalysisCostClassification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "costBehavior" "CostBehavior" NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisCostClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisAutomationConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "analysisType" "AdvancedAnalysisType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "AnalysisFrequency",
    "defaultParameters" JSONB,
    "alertCondition" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisAutomationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "analysisType" "AdvancedAnalysisType" NOT NULL,
    "triggerSource" "AnalysisTriggerSource" NOT NULL,
    "triggeredByUserId" TEXT,
    "parameters" JSONB NOT NULL,
    "numericResult" JSONB NOT NULL,
    "chartType" "AnalysisChartType" NOT NULL,
    "chartData" JSONB NOT NULL,
    "causeExplanation" TEXT NOT NULL,
    "simpleInterpretation" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL,
    "generatedAlertId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisBenchmarkValue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "industryValue" DECIMAL(18,4) NOT NULL,
    "unit" TEXT,
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisBenchmarkValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisCostClassification_accountId_key" ON "AnalysisCostClassification"("accountId");

-- CreateIndex
CREATE INDEX "AnalysisCostClassification_companyId_idx" ON "AnalysisCostClassification"("companyId");

-- CreateIndex
CREATE INDEX "AnalysisAutomationConfig_companyId_idx" ON "AnalysisAutomationConfig"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisAutomationConfig_companyId_analysisType_key" ON "AnalysisAutomationConfig"("companyId", "analysisType");

-- CreateIndex
CREATE INDEX "AnalysisReport_companyId_analysisType_idx" ON "AnalysisReport"("companyId", "analysisType");

-- CreateIndex
CREATE INDEX "AnalysisReport_companyId_createdAt_idx" ON "AnalysisReport"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisBenchmarkValue_companyId_idx" ON "AnalysisBenchmarkValue"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisBenchmarkValue_companyId_metricKey_key" ON "AnalysisBenchmarkValue"("companyId", "metricKey");

-- AddForeignKey
ALTER TABLE "AnalysisCostClassification" ADD CONSTRAINT "AnalysisCostClassification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisCostClassification" ADD CONSTRAINT "AnalysisCostClassification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisCostClassification" ADD CONSTRAINT "AnalysisCostClassification_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisAutomationConfig" ADD CONSTRAINT "AnalysisAutomationConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisAutomationConfig" ADD CONSTRAINT "AnalysisAutomationConfig_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisReport" ADD CONSTRAINT "AnalysisReport_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisBenchmarkValue" ADD CONSTRAINT "AnalysisBenchmarkValue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisBenchmarkValue" ADD CONSTRAINT "AnalysisBenchmarkValue_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

