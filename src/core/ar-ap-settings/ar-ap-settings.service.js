// Configuración compartida por Cuentas por Cobrar (AR) y Cuentas por
// Pagar (AP): a qué cuenta contable va cada una por defecto, y el
// consecutivo de numeración de facturas/pagos. Vive en /core porque
// los dos módulos la necesitan por igual (regla 1 de la arquitectura
// maestra: "todo lo usado por 2+ módulos vive en /core").
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');

async function getOrCreateSettings(companyId) {
  let settings = await prisma.arApSettings.findUnique({ where: { companyId } });
  if (!settings) {
    settings = await prisma.arApSettings.create({ data: { companyId } });
  }
  return settings;
}

async function updateSettings(companyId, userId, changes) {
  const settings = await getOrCreateSettings(companyId);

  if (changes.receivableGlAccountId) {
    const account = await prisma.account.findFirst({ where: { id: changes.receivableGlAccountId, companyId } });
    if (!account) {
      throw new AppError('La cuenta de Cuentas por Cobrar indicada no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
    }
  }
  if (changes.payableGlAccountId) {
    const account = await prisma.account.findFirst({ where: { id: changes.payableGlAccountId, companyId } });
    if (!account) {
      throw new AppError('La cuenta de Cuentas por Pagar indicada no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.arApSettings.update({ where: { companyId }, data: changes });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'ar_ap_settings.updated',
        entityType: 'ArApSettings',
        entityId: settings.id,
        oldValue: settings,
        newValue: updated,
      },
      tx
    );
    return updated;
  });
}

// Asegura que exista una cuenta de AR configurada antes de facturar;
// devuelve su id. Falla con un mensaje claro si falta configurar.
async function assertReceivableAccountConfigured(companyId) {
  const settings = await getOrCreateSettings(companyId);
  if (!settings.receivableGlAccountId) {
    throw new AppError(
      'Todavía no se configuró la cuenta contable de Cuentas por Cobrar. Configúrala en Ajustes antes de facturar.',
      400,
      'RECEIVABLE_ACCOUNT_NOT_CONFIGURED'
    );
  }
  return settings.receivableGlAccountId;
}

async function assertPayableAccountConfigured(companyId) {
  const settings = await getOrCreateSettings(companyId);
  if (!settings.payableGlAccountId) {
    throw new AppError(
      'Todavía no se configuró la cuenta contable de Cuentas por Pagar. Configúrala en Ajustes antes de registrar facturas.',
      400,
      'PAYABLE_ACCOUNT_NOT_CONFIGURED'
    );
  }
  return settings.payableGlAccountId;
}

// Numeración consecutiva por empresa, con incremento atómico (mismo
// criterio que AccountingSettings.currentEntryNumberSequence en
// core/ledger) — evita que dos facturas se creen con el mismo número
// si llegan casi al mismo tiempo.
async function getNextArInvoiceNumber(companyId, tx) {
  const client = tx || prisma;
  await client.arApSettings.upsert({ where: { companyId }, create: { companyId }, update: {} });
  const updated = await client.arApSettings.update({
    where: { companyId },
    data: { currentArInvoiceNumberSequence: { increment: 1 } },
  });
  return updated.currentArInvoiceNumberSequence;
}

async function getNextApBillNumber(companyId, tx) {
  const client = tx || prisma;
  await client.arApSettings.upsert({ where: { companyId }, create: { companyId }, update: {} });
  const updated = await client.arApSettings.update({
    where: { companyId },
    data: { currentApBillNumberSequence: { increment: 1 } },
  });
  return updated.currentApBillNumberSequence;
}

async function getNextArCreditNoteNumber(companyId, tx) {
  const client = tx || prisma;
  await client.arApSettings.upsert({ where: { companyId }, create: { companyId }, update: {} });
  const updated = await client.arApSettings.update({
    where: { companyId },
    data: { currentArCreditNoteNumberSequence: { increment: 1 } },
  });
  return updated.currentArCreditNoteNumberSequence;
}

module.exports = {
  getOrCreateSettings,
  updateSettings,
  assertReceivableAccountConfigured,
  assertPayableAccountConfigured,
  getNextArInvoiceNumber,
  getNextApBillNumber,
  getNextArCreditNoteNumber,
};
