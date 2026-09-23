-- CreateIndex
CREATE INDEX "FiscalElectronicDocument_companyId_idx" ON "FiscalElectronicDocument"("companyId");

-- CreateIndex
CREATE INDEX "InventoryLot_companyId_idx" ON "InventoryLot"("companyId");

-- CreateIndex
CREATE INDEX "InventoryTransfer_companyId_idx" ON "InventoryTransfer"("companyId");

-- CreateIndex
CREATE INDEX "PhysicalCount_companyId_idx" ON "PhysicalCount"("companyId");

-- CreateIndex
CREATE INDEX "StatementImport_companyId_idx" ON "StatementImport"("companyId");
