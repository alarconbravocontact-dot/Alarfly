const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function createVendor(companyId, data, userId = null) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({
      data: {
        companyId,
        name: data.name,
        taxId: data.taxId || null,
        email: data.email || null,
        phone: data.phone || null,
        paymentTermsDays: data.paymentTermsDays ?? 30,
      },
    });
    await auditService.log(
      { companyId, userId, action: 'vendor.created', entityType: 'Vendor', entityId: vendor.id, newValue: { name: vendor.name, taxId: vendor.taxId } },
      tx
    );
    return vendor;
  });
}

// Fase 2 (maestros): antes de esto, Vendor no auditaba absolutamente
// nada — ni siquiera activar/desactivar (que en el frontend ya se
// podía hacer desde VendorsPage, sin dejar rastro).
async function updateVendor(companyId, id, changes, userId = null) {
  const vendor = await prisma.vendor.findFirst({ where: { id, companyId } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe.', 404, 'VENDOR_NOT_FOUND');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.vendor.update({ where: { id }, data: changes });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'vendor.updated',
        entityType: 'Vendor',
        entityId: id,
        oldValue: changes.isActive !== undefined ? { isActive: vendor.isActive } : undefined,
        newValue: changes,
      },
      tx
    );
    return updated;
  });
}

async function listVendors(companyId, { isActive } = {}) {
  return prisma.vendor.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

async function getVendor(companyId, id) {
  const vendor = await prisma.vendor.findFirst({ where: { id, companyId } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe.', 404, 'VENDOR_NOT_FOUND');
  }
  return vendor;
}

module.exports = { createVendor, updateVendor, listVendors, getVendor };
