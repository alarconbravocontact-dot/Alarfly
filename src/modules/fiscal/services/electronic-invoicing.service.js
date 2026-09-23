const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { getProvider } = require('./electronic-invoicing/providers');

// Genera el comprobante fiscal electrónico de una transacción ya
// registrada, a través del adaptador del proveedor configurado (hoy
// solo MOCK). Cada FiscalTransaction tiene a lo sumo un comprobante
// (relación 1 a 1) — volver a generarlo para la misma transacción no
// está soportado todavía (habría que anularlo primero).
async function generateDocument(companyId, userId, fiscalTransactionId, provider = 'MOCK') {
  const fiscalTransaction = await prisma.fiscalTransaction.findFirst({
    where: { id: fiscalTransactionId, companyId },
    include: { electronicDocument: true },
  });
  if (!fiscalTransaction) {
    throw new AppError('La transacción fiscal indicada no existe.', 404, 'FISCAL_TRANSACTION_NOT_FOUND');
  }
  if (fiscalTransaction.electronicDocument) {
    throw new AppError('Esta transacción ya tiene un comprobante electrónico generado.', 409, 'DOCUMENT_ALREADY_EXISTS');
  }

  const adapter = getProvider(provider);
  const requestPayload = {
    type: fiscalTransaction.type,
    date: fiscalTransaction.date,
    counterpartyName: fiscalTransaction.counterpartyName,
    counterpartyTaxId: fiscalTransaction.counterpartyTaxId,
    documentNumber: fiscalTransaction.documentNumber,
    taxBase: fiscalTransaction.taxBase.toFixed(2),
    taxAmount: fiscalTransaction.taxAmount.toFixed(2),
    withholdingAmount: fiscalTransaction.withholdingAmount.toFixed(2),
  };

  const result = adapter.generate(fiscalTransaction);

  return prisma.$transaction(async (tx) => {
    const document = await tx.fiscalElectronicDocument.create({
      data: {
        companyId,
        fiscalTransactionId,
        provider,
        status: result.status,
        externalDocumentId: result.externalDocumentId,
        validationCode: result.validationCode,
        requestPayload,
        responsePayload: result.responsePayload || null,
        errorMessage: result.errorMessage || null,
        issuedAt: result.status === 'GENERATED' ? new Date() : null,
        generatedByUserId: userId,
      },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: result.status === 'GENERATED' ? 'fiscal_electronic_document.generated' : 'fiscal_electronic_document.rejected',
        entityType: 'FiscalElectronicDocument',
        entityId: document.id,
        oldValue: null,
        newValue: document,
      },
      tx
    );
    return document;
  });
}

async function cancelDocument(companyId, userId, id, reason) {
  const document = await prisma.fiscalElectronicDocument.findFirst({ where: { id, companyId } });
  if (!document) {
    throw new AppError('El comprobante indicado no existe.', 404, 'DOCUMENT_NOT_FOUND');
  }
  if (document.status !== 'GENERATED') {
    throw new AppError('Solo se puede anular un comprobante que haya sido generado.', 409, 'DOCUMENT_NOT_CANCELLABLE');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fiscalElectronicDocument.update({
      where: { id },
      data: { status: 'CANCELLED', errorMessage: reason },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fiscal_electronic_document.cancelled',
        entityType: 'FiscalElectronicDocument',
        entityId: id,
        oldValue: { status: document.status },
        newValue: { status: 'CANCELLED', reason },
      },
      tx
    );
    return updated;
  });
}

async function getDocument(companyId, id) {
  const document = await prisma.fiscalElectronicDocument.findFirst({
    where: { id, companyId },
    include: { fiscalTransaction: true },
  });
  if (!document) {
    throw new AppError('El comprobante indicado no existe.', 404, 'DOCUMENT_NOT_FOUND');
  }
  return document;
}

async function listDocuments(companyId, { status } = {}) {
  return prisma.fiscalElectronicDocument.findMany({
    where: { companyId, status: status || undefined },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { generateDocument, cancelDocument, getDocument, listDocuments };
