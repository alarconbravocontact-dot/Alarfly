const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function createCustomer(companyId, data) {
  return prisma.customer.create({
    data: {
      companyId,
      name: data.name,
      taxId: data.taxId || null,
      email: data.email || null,
      phone: data.phone || null,
      paymentTermsDays: data.paymentTermsDays ?? 30,
      creditLimit: data.creditLimit ?? null,
      maxOverdueDaysAllowed: data.maxOverdueDaysAllowed ?? null,
      isForeign: data.isForeign ?? false,
      billingCurrency: data.billingCurrency || null,
    },
  });
}

async function updateCustomer(companyId, id, changes) {
  const customer = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe.', 404, 'CUSTOMER_NOT_FOUND');
  }
  return prisma.customer.update({ where: { id }, data: changes });
}

// Bloqueo manual (ej. decisión del área de cobranza). El bloqueo
// automático por atraso escalonado (nivel crítico) usa esta misma
// función desde ar-collections.service, para no duplicar la lógica de
// "qué significa estar bloqueado".
async function blockCustomer(companyId, id, userId, reason) {
  const customer = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe.', 404, 'CUSTOMER_NOT_FOUND');
  }
  if (customer.isBlocked) {
    throw new AppError('Este cliente ya está bloqueado.', 409, 'CUSTOMER_ALREADY_BLOCKED');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id },
      data: { isBlocked: true, blockedReason: reason, blockedAt: new Date() },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'customer.blocked',
        entityType: 'Customer',
        entityId: id,
        oldValue: { isBlocked: false },
        newValue: { isBlocked: true, blockedReason: reason },
      },
      tx
    );
    return updated;
  });
}

async function unblockCustomer(companyId, id, userId) {
  const customer = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe.', 404, 'CUSTOMER_NOT_FOUND');
  }
  if (!customer.isBlocked) {
    throw new AppError('Este cliente no está bloqueado.', 409, 'CUSTOMER_NOT_BLOCKED');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id },
      data: { isBlocked: false, blockedReason: null, blockedAt: null },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'customer.unblocked',
        entityType: 'Customer',
        entityId: id,
        oldValue: { isBlocked: true },
        newValue: { isBlocked: false },
      },
      tx
    );
    return updated;
  });
}

// Mismo criterio que core/middlewares/errorHandler: nunca dejar pasar
// un error técnico crudo (ej. el texto interno de Prisma) hacia una
// pantalla — acá no se puede reutilizar el middleware porque el error
// se atrapa fila por fila, sin llegar nunca a escapar del servicio.
function friendlyImportError(err, row) {
  if (err instanceof AppError) return err.message;
  if (err.code === 'P2002') return `Ya existe un cliente con el nombre "${row.name}".`;
  return 'No se pudo crear este cliente. Revisa sus datos e intenta de nuevo.';
}

// Asistente de importación: crea uno por uno (no en una sola
// transacción) para que una fila con un dato malo no bote las demás
// que sí estaban bien — cada fila reporta su propio resultado, el
// frontend le muestra al usuario exactamente cuáles se crearon y
// cuáles no, con el motivo real de cada una.
async function importCustomers(companyId, rows) {
  const results = { created: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    try {
      await createCustomer(companyId, rows[i]);
      results.created += 1;
    } catch (err) {
      results.errors.push({ row: i + 1, message: friendlyImportError(err, rows[i]) });
    }
  }
  return results;
}

async function listCustomers(companyId, { isActive } = {}) {
  return prisma.customer.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

async function getCustomer(companyId, id) {
  const customer = await prisma.customer.findFirst({ where: { id, companyId } });
  if (!customer) {
    throw new AppError('El cliente indicado no existe.', 404, 'CUSTOMER_NOT_FOUND');
  }
  return customer;
}

module.exports = { createCustomer, updateCustomer, blockCustomer, unblockCustomer, listCustomers, getCustomer, importCustomers };
