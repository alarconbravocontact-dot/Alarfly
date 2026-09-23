const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

async function createVendor(companyId, data) {
  return prisma.vendor.create({
    data: {
      companyId,
      name: data.name,
      taxId: data.taxId || null,
      email: data.email || null,
      phone: data.phone || null,
      paymentTermsDays: data.paymentTermsDays ?? 30,
    },
  });
}

async function updateVendor(companyId, id, changes) {
  const vendor = await prisma.vendor.findFirst({ where: { id, companyId } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe.', 404, 'VENDOR_NOT_FOUND');
  }
  return prisma.vendor.update({ where: { id }, data: changes });
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
