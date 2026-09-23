// Métodos de pago (Fase 3, punto 23): catálogo liviano y configurable
// por empresa. Alarfly NUNCA procesa Zelle/Binance/Pago Móvil/tarjeta
// externamente — solo los registra y concilia, así que este maestro no
// necesita más que un código y un nombre. Vive en core/ porque, igual
// que ArApSettings, más de un módulo de dinero puede necesitarlo (hoy
// Cobros de AR; nada impide que Pagos de AP lo use más adelante sin
// crear un segundo catálogo).
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');

const DEFAULT_METHODS = [
  { code: 'CASH', name: 'Efectivo' },
  { code: 'BANK_TRANSFER', name: 'Transferencia' },
  { code: 'CARD', name: 'Tarjeta' },
  { code: 'PAGO_MOVIL', name: 'Pago Móvil' },
  { code: 'ZELLE', name: 'Zelle' },
  { code: 'BINANCE', name: 'Binance' },
  { code: 'OTHER', name: 'Otro' },
];

// Se siembra sola, una vez, la primera vez que se listan — así una
// empresa nueva ya tiene los métodos comunes sin que nadie tenga que
// crearlos a mano, y el Administrador puede desactivar los que no use
// o agregar otros (nunca se fuerza a mantenerlos).
async function ensureDefaults(companyId) {
  const count = await prisma.paymentMethod.count({ where: { companyId } });
  if (count > 0) return;
  await prisma.paymentMethod.createMany({ data: DEFAULT_METHODS.map((m) => ({ companyId, ...m })) });
}

async function createPaymentMethod(companyId, userId, data) {
  return prisma.$transaction(async (tx) => {
    const method = await tx.paymentMethod.create({ data: { companyId, code: data.code, name: data.name } });
    await auditService.log(
      { companyId, userId, action: 'payment_method.created', entityType: 'PaymentMethod', entityId: method.id, newValue: method },
      tx
    );
    return method;
  });
}

async function updatePaymentMethod(companyId, userId, id, changes) {
  const method = await prisma.paymentMethod.findFirst({ where: { id, companyId } });
  if (!method) {
    throw new AppError('El método de pago indicado no existe.', 404, 'PAYMENT_METHOD_NOT_FOUND');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentMethod.update({ where: { id }, data: changes });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_method.updated',
        entityType: 'PaymentMethod',
        entityId: id,
        oldValue: changes.isActive !== undefined ? { isActive: method.isActive } : undefined,
        newValue: changes,
      },
      tx
    );
    return updated;
  });
}

async function listPaymentMethods(companyId, { isActive } = {}) {
  await ensureDefaults(companyId);
  return prisma.paymentMethod.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

module.exports = { createPaymentMethod, updatePaymentMethod, listPaymentMethods, ensureDefaults };
