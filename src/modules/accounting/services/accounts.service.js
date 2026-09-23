const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

function buildTree(accounts) {
  const byId = new Map(accounts.map((account) => [account.id, { ...account, children: [] }]));
  const roots = [];

  for (const account of byId.values()) {
    if (account.parentId && byId.has(account.parentId)) {
      byId.get(account.parentId).children.push(account);
    } else {
      roots.push(account);
    }
  }

  return roots;
}

async function createAccount(companyId, userId, data) {
  if (data.parentId) {
    const parent = await prisma.account.findFirst({ where: { id: data.parentId, companyId } });
    if (!parent) {
      throw new AppError('La cuenta padre indicada no existe en esta empresa.', 400, 'PARENT_NOT_FOUND');
    }
  }

  const existing = await prisma.account.findUnique({ where: { companyId_code: { companyId, code: data.code } } });
  if (existing) {
    throw new AppError(`Ya existe una cuenta con el código "${data.code}".`, 409, 'ACCOUNT_CODE_EXISTS');
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        type: data.type,
        normalBalance: data.normalBalance,
        parentId: data.parentId || null,
        isPostable: data.isPostable ?? true,
        description: data.description || null,
        financialStatementSection: data.financialStatementSection || null,
      },
    });

    // Una cuenta que ya tiene hijas pasa a ser agrupadora: deja de
    // recibir movimientos directos.
    if (data.parentId) {
      await tx.account.update({ where: { id: data.parentId }, data: { isPostable: false } });
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'account.created',
        entityType: 'Account',
        entityId: account.id,
        oldValue: null,
        newValue: account,
      },
      tx
    );

    return account;
  });
}

async function updateAccount(companyId, accountId, userId, changes) {
  const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
  if (!account) {
    throw new AppError('La cuenta indicada no existe.', 404, 'ACCOUNT_NOT_FOUND');
  }

  const allowedChanges = {
    name: changes.name,
    description: changes.description,
    isActive: changes.isActive,
    financialStatementSection: changes.financialStatementSection,
    isForeignCurrency: changes.isForeignCurrency,
    foreignCurrencyCode: changes.foreignCurrencyCode,
    isIntercompany: changes.isIntercompany,
    intercompanyCompanyId: changes.intercompanyCompanyId,
  };

  return prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({ where: { id: accountId }, data: allowedChanges });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'account.updated',
        entityType: 'Account',
        entityId: accountId,
        oldValue: account,
        newValue: updated,
      },
      tx
    );

    return updated;
  });
}

async function deleteAccount(companyId, accountId, userId) {
  const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
  if (!account) {
    throw new AppError('La cuenta indicada no existe.', 404, 'ACCOUNT_NOT_FOUND');
  }

  const childCount = await prisma.account.count({ where: { parentId: accountId } });
  if (childCount > 0) {
    throw new AppError('No se puede eliminar una cuenta que tiene cuentas hijas.', 409, 'ACCOUNT_HAS_CHILDREN');
  }

  const movementCount = await prisma.journalEntryLine.count({ where: { accountId } });
  if (movementCount > 0) {
    throw new AppError(
      'No se puede eliminar esta cuenta porque ya tiene movimientos contables registrados.',
      409,
      'ACCOUNT_HAS_MOVEMENTS'
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.account.delete({ where: { id: accountId } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'account.deleted',
        entityType: 'Account',
        entityId: accountId,
        oldValue: account,
        newValue: null,
      },
      tx
    );
  });
}

async function listAccounts(companyId, { type, isActive } = {}) {
  return prisma.account.findMany({
    where: { companyId, type: type || undefined, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { code: 'asc' },
  });
}

async function getAccountTree(companyId) {
  const accounts = await listAccounts(companyId);
  return buildTree(accounts);
}

async function getAccount(companyId, accountId) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId },
    include: { parent: true, children: true },
  });
  if (!account) {
    throw new AppError('La cuenta indicada no existe.', 404, 'ACCOUNT_NOT_FOUND');
  }
  return account;
}

module.exports = { createAccount, updateAccount, deleteAccount, listAccounts, getAccountTree, getAccount };
