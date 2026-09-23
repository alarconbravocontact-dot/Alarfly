const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function uploadDocument(companyId, userId, data) {
  const fiscalTransaction = await prisma.fiscalTransaction.findFirst({
    where: { id: data.fiscalTransactionId, companyId },
  });
  if (!fiscalTransaction) {
    throw new AppError('La transacción fiscal indicada no existe.', 404, 'FISCAL_TRANSACTION_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const file = await tx.fiscalDocumentFile.create({
      data: {
        companyId,
        fiscalTransactionId: data.fiscalTransactionId,
        fileType: data.fileType,
        fileName: data.fileName,
        mimeType: data.mimeType,
        content: data.content,
        uploadedByUserId: userId,
      },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fiscal_document_file.uploaded',
        entityType: 'FiscalDocumentFile',
        entityId: file.id,
        oldValue: null,
        newValue: { id: file.id, fileName: file.fileName, fileType: file.fileType, fiscalTransactionId: file.fiscalTransactionId },
      },
      tx
    );
    return file;
  });
}

// Búsqueda por cliente/proveedor (nombre o NIT/RFC de la contraparte),
// periodo (rango de fechas de la transacción) y tipo de archivo —
// reutiliza los datos que ya tiene FiscalTransaction, sin duplicarlos.
async function searchDocuments(companyId, { counterparty, from, to, fileType } = {}) {
  return prisma.fiscalDocumentFile.findMany({
    where: {
      companyId,
      fileType: fileType || undefined,
      fiscalTransaction: {
        date: from || to ? { gte: from, lte: to } : undefined,
        OR: counterparty
          ? [
              { counterpartyName: { contains: counterparty, mode: 'insensitive' } },
              { counterpartyTaxId: { contains: counterparty, mode: 'insensitive' } },
            ]
          : undefined,
      },
    },
    include: {
      fiscalTransaction: {
        select: { id: true, type: true, date: true, counterpartyName: true, counterpartyTaxId: true, documentNumber: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getDocument(companyId, id) {
  const file = await prisma.fiscalDocumentFile.findFirst({ where: { id, companyId }, include: { fiscalTransaction: true } });
  if (!file) {
    throw new AppError('El documento indicado no existe.', 404, 'DOCUMENT_FILE_NOT_FOUND');
  }
  return file;
}

// No se puede eliminar un documento si la transacción a la que
// pertenece ya está en un periodo contable cerrado — mismo criterio de
// "lo que ya se cerró no se toca" que usa Contabilidad para los
// asientos.
async function deleteDocument(companyId, id, userId) {
  const file = await prisma.fiscalDocumentFile.findFirst({
    where: { id, companyId },
    include: { fiscalTransaction: { include: { journalEntry: { include: { period: true } } } } },
  });
  if (!file) {
    throw new AppError('El documento indicado no existe.', 404, 'DOCUMENT_FILE_NOT_FOUND');
  }
  if (file.fiscalTransaction.journalEntry.period.status === 'CLOSED') {
    throw new AppError(
      'No se puede eliminar este documento: el periodo contable de su transacción ya está cerrado.',
      409,
      'PERIOD_CLOSED'
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.fiscalDocumentFile.delete({ where: { id } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fiscal_document_file.deleted',
        entityType: 'FiscalDocumentFile',
        entityId: id,
        oldValue: { fileName: file.fileName, fiscalTransactionId: file.fiscalTransactionId },
        newValue: null,
      },
      tx
    );
  });
}

module.exports = { uploadDocument, searchDocuments, getDocument, deleteDocument };
