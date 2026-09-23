-- CreateTable
CREATE TABLE "PanelCollapsePreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "panelKey" TEXT NOT NULL,
    "isCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanelCollapsePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PanelCollapsePreference_companyId_panelKey_idx" ON "PanelCollapsePreference"("companyId", "panelKey");

-- CreateIndex
CREATE UNIQUE INDEX "PanelCollapsePreference_userId_panelKey_key" ON "PanelCollapsePreference"("userId", "panelKey");

-- AddForeignKey
ALTER TABLE "PanelCollapsePreference" ADD CONSTRAINT "PanelCollapsePreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelCollapsePreference" ADD CONSTRAINT "PanelCollapsePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

