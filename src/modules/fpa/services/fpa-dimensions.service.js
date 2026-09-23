const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { assertNoCycle } = require('./fpa-dimensions.rules');

function buildTree(dimensions) {
  const byId = new Map(dimensions.map((d) => [d.id, { ...d, children: [] }]));
  const roots = [];

  for (const dimension of byId.values()) {
    if (dimension.parentId && byId.has(dimension.parentId)) {
      byId.get(dimension.parentId).children.push(dimension);
    } else {
      roots.push(dimension);
    }
  }

  return roots;
}

async function createDimension(companyId, userId, data) {
  if (data.parentId) {
    const parent = await prisma.fpaDimension.findFirst({ where: { id: data.parentId, companyId } });
    if (!parent) {
      throw new AppError('La dimensión padre indicada no existe en esta empresa.', 400, 'PARENT_NOT_FOUND');
    }
  }

  return prisma.$transaction(async (tx) => {
    const dimension = await tx.fpaDimension.create({
      data: { companyId, type: data.type, name: data.name, parentId: data.parentId || null },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fpa_dimension.created',
        entityType: 'FpaDimension',
        entityId: dimension.id,
        oldValue: null,
        newValue: dimension,
      },
      tx
    );
    return dimension;
  });
}

async function updateDimension(companyId, id, userId, changes) {
  const dimension = await prisma.fpaDimension.findFirst({ where: { id, companyId } });
  if (!dimension) {
    throw new AppError('La dimensión indicada no existe.', 404, 'FPA_DIMENSION_NOT_FOUND');
  }

  if (changes.parentId !== undefined && changes.parentId !== dimension.parentId) {
    if (changes.parentId) {
      const parent = await prisma.fpaDimension.findFirst({ where: { id: changes.parentId, companyId } });
      if (!parent) {
        throw new AppError('La dimensión padre indicada no existe en esta empresa.', 400, 'PARENT_NOT_FOUND');
      }
    }
    const allDimensions = await prisma.fpaDimension.findMany({
      where: { companyId },
      select: { id: true, parentId: true },
    });
    assertNoCycle(id, changes.parentId, allDimensions);
  }

  const allowedChanges = { name: changes.name, isActive: changes.isActive, parentId: changes.parentId };

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fpaDimension.update({ where: { id }, data: allowedChanges });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fpa_dimension.updated',
        entityType: 'FpaDimension',
        entityId: id,
        oldValue: dimension,
        newValue: updated,
      },
      tx
    );
    return updated;
  });
}

async function deleteDimension(companyId, id, userId) {
  const dimension = await prisma.fpaDimension.findFirst({ where: { id, companyId } });
  if (!dimension) {
    throw new AppError('La dimensión indicada no existe.', 404, 'FPA_DIMENSION_NOT_FOUND');
  }

  const childCount = await prisma.fpaDimension.count({ where: { parentId: id } });
  if (childCount > 0) {
    throw new AppError('No se puede eliminar una dimensión que tiene dimensiones hijas.', 409, 'FPA_DIMENSION_HAS_CHILDREN');
  }

  const lineTagCount = await prisma.journalEntryLineFpaDimension.count({ where: { fpaDimensionId: id } });
  if (lineTagCount > 0) {
    throw new AppError(
      'No se puede eliminar esta dimensión porque ya está usada en asientos contables.',
      409,
      'FPA_DIMENSION_IN_USE'
    );
  }

  const budgetLineCount = await prisma.budgetLine.count({ where: { fpaDimensionId: id } });
  if (budgetLineCount > 0) {
    throw new AppError(
      'No se puede eliminar esta dimensión porque ya está usada en un presupuesto.',
      409,
      'FPA_DIMENSION_IN_USE'
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.fpaDimension.delete({ where: { id } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fpa_dimension.deleted',
        entityType: 'FpaDimension',
        entityId: id,
        oldValue: dimension,
        newValue: null,
      },
      tx
    );
  });
}

async function listDimensions(companyId, { type, isActive } = {}) {
  return prisma.fpaDimension.findMany({
    where: { companyId, type: type || undefined, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

async function getDimensionTree(companyId) {
  const dimensions = await listDimensions(companyId);
  return buildTree(dimensions);
}

async function getDimension(companyId, id) {
  const dimension = await prisma.fpaDimension.findFirst({
    where: { id, companyId },
    include: { parent: true, children: true },
  });
  if (!dimension) {
    throw new AppError('La dimensión indicada no existe.', 404, 'FPA_DIMENSION_NOT_FOUND');
  }
  return dimension;
}

// Etiqueta una línea de asiento ya existente con una dimensión de
// FP&A. Usa su propia tabla puente (JournalEntryLineFpaDimension), en
// paralelo a JournalEntryLineDimension que ya usa Tesorería — ninguna
// de las dos toca a la otra.
async function tagJournalEntryLine(companyId, userId, { lineId, fpaDimensionId }) {
  const dimension = await prisma.fpaDimension.findFirst({ where: { id: fpaDimensionId, companyId } });
  if (!dimension) {
    throw new AppError('La dimensión indicada no existe.', 404, 'FPA_DIMENSION_NOT_FOUND');
  }

  const line = await prisma.journalEntryLine.findFirst({ where: { id: lineId, journalEntry: { companyId } } });
  if (!line) {
    throw new AppError('La línea de asiento indicada no existe.', 404, 'JOURNAL_ENTRY_LINE_NOT_FOUND');
  }

  const existing = await prisma.journalEntryLineFpaDimension.findUnique({
    where: { lineId_fpaDimensionId: { lineId, fpaDimensionId } },
  });
  if (existing) {
    throw new AppError('Esta línea ya tiene esa etiqueta.', 409, 'TAG_ALREADY_EXISTS');
  }

  return prisma.$transaction(async (tx) => {
    const tag = await tx.journalEntryLineFpaDimension.create({ data: { lineId, fpaDimensionId } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fpa_dimension.tagged_line',
        entityType: 'JournalEntryLineFpaDimension',
        entityId: tag.id,
        oldValue: null,
        newValue: tag,
      },
      tx
    );
    return tag;
  });
}

async function untagJournalEntryLine(companyId, userId, tagId) {
  const tag = await prisma.journalEntryLineFpaDimension.findFirst({
    where: { id: tagId, line: { journalEntry: { companyId } } },
  });
  if (!tag) {
    throw new AppError('La etiqueta indicada no existe.', 404, 'TAG_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    await tx.journalEntryLineFpaDimension.delete({ where: { id: tagId } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fpa_dimension.untagged_line',
        entityType: 'JournalEntryLineFpaDimension',
        entityId: tagId,
        oldValue: tag,
        newValue: null,
      },
      tx
    );
  });
}

module.exports = {
  createDimension,
  updateDimension,
  deleteDimension,
  listDimensions,
  getDimensionTree,
  getDimension,
  tagJournalEntryLine,
  untagJournalEntryLine,
};
