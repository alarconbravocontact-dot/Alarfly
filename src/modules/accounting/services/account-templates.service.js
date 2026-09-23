const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function listTemplates() {
  return prisma.accountTemplate.findMany({ include: { _count: { select: { lines: true } } } });
}

// Crea las cuentas reales de una empresa a partir de una plantilla.
// Resuelve la jerarquía (parentCode) en varias pasadas para que no
// importe en qué orden estén guardadas las líneas de la plantilla.
async function applyTemplate(companyId, templateId, userId) {
  const template = await prisma.accountTemplate.findUnique({
    where: { id: templateId },
    include: { lines: { orderBy: { order: 'asc' } } },
  });
  if (!template) {
    throw new AppError('La plantilla indicada no existe.', 404, 'TEMPLATE_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const codeToAccountId = new Map();
    let remaining = [...template.lines];

    while (remaining.length > 0) {
      const stillPending = [];

      for (const line of remaining) {
        const parentId = line.parentCode ? codeToAccountId.get(line.parentCode) : null;
        if (line.parentCode && !parentId) {
          stillPending.push(line);
          continue;
        }

        const account = await tx.account.create({
          data: {
            companyId,
            code: line.code,
            name: line.name,
            type: line.type,
            normalBalance: line.normalBalance,
            parentId: parentId || null,
            isPostable: line.isPostable,
            financialStatementSection: line.financialStatementSection,
          },
        });
        codeToAccountId.set(line.code, account.id);
      }

      if (stillPending.length === remaining.length) {
        throw new AppError(
          'La plantilla tiene una referencia de jerarquía inválida (una cuenta hija apunta a un código que no existe).',
          400,
          'INVALID_TEMPLATE'
        );
      }
      remaining = stillPending;
    }

    await tx.company.update({
      where: { id: companyId },
      data: { accountTemplatesApplied: { connect: { id: templateId } } },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'account_template.applied',
        entityType: 'AccountTemplate',
        entityId: templateId,
        oldValue: null,
        newValue: { accountsCreated: template.lines.length },
      },
      tx
    );

    return tx.account.findMany({ where: { companyId }, orderBy: { code: 'asc' } });
  });
}

module.exports = { listTemplates, applyTemplate };
