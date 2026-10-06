// Maestro de empleados. CRUD sencillo, mismo criterio que Vendor/
// Customer (AR/AP) — sin workflow, solo Activo/Inactivo (sección 5 del
// prompt del módulo: "no crear un workflow complejo de RR.HH.").
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

// Reutiliza EXACTAMENTE el mismo criterio que
// treasury/treasury-accounts.service.assertBranchDimensionUsable — una
// Dimension tipo BRANCH ya existente, nunca un modelo de sucursal nuevo.
async function assertBranchDimensionUsable(companyId, branchDimensionId) {
  if (!branchDimensionId) return;
  const dimension = await prisma.dimension.findFirst({ where: { id: branchDimensionId, companyId, type: 'BRANCH' } });
  if (!dimension) {
    throw new AppError('La sucursal indicada no existe (debe ser una dimensión de tipo BRANCH).', 400, 'BRANCH_NOT_FOUND');
  }
}

// El departamento/centro de costo es una FpaDimension cualquiera de la
// empresa (DEPARTMENT o COST_CENTER, a elección de quien la creó en
// FP&A) — no se restringe el tipo acá, porque el propio catálogo de
// FP&A ya decide qué tipos existen.
async function assertFpaDimensionUsable(companyId, fpaDimensionId) {
  if (!fpaDimensionId) return;
  const dimension = await prisma.fpaDimension.findFirst({ where: { id: fpaDimensionId, companyId } });
  if (!dimension) {
    throw new AppError('El departamento/centro de costo indicado no existe.', 400, 'FPA_DIMENSION_NOT_FOUND');
  }
}

async function assertSupervisorUsable(companyId, supervisorId, excludeEmployeeId = null) {
  if (!supervisorId) return;
  if (supervisorId === excludeEmployeeId) {
    throw new AppError('Un empleado no puede ser su propio supervisor.', 400, 'INVALID_SUPERVISOR');
  }
  const supervisor = await prisma.employee.findFirst({ where: { id: supervisorId, companyId } });
  if (!supervisor) {
    throw new AppError('El supervisor indicado no existe.', 400, 'SUPERVISOR_NOT_FOUND');
  }
}

async function createEmployee(companyId, userId, data) {
  await assertBranchDimensionUsable(companyId, data.branchDimensionId);
  await assertFpaDimensionUsable(companyId, data.fpaDimensionId);
  await assertSupervisorUsable(companyId, data.supervisorId);

  if (data.documentId) {
    const existing = await prisma.employee.findFirst({ where: { companyId, documentId: data.documentId } });
    if (existing) {
      throw new AppError(`Ya existe un empleado con el documento "${data.documentId}".`, 409, 'DOCUMENT_ID_EXISTS');
    }
  }

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: { companyId, createdByUserId: userId, ...data },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'employee.created',
        entityType: 'Employee',
        entityId: employee.id,
        oldValue: null,
        newValue: { firstName: employee.firstName, lastName: employee.lastName, position: employee.position },
      },
      tx
    );
    return employee;
  });
}

// Campos "sensibles" (sección 20: "modificación de información
// sensible" debe auditarse) — económicos y de identificación. Un
// cambio de teléfono no es lo mismo que un cambio de salario; ambos se
// auditan igual (todo `employee.updated` queda registrado), pero se
// guarda explícito QUÉ cambió para que el historial sea legible.
const SENSITIVE_FIELDS = ['baseSalary', 'currency', 'payFrequency', 'documentId', 'status'];

async function updateEmployee(companyId, id, userId, changes) {
  const employee = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!employee) {
    throw new AppError('El empleado indicado no existe.', 404, 'EMPLOYEE_NOT_FOUND');
  }
  await assertBranchDimensionUsable(companyId, changes.branchDimensionId);
  await assertFpaDimensionUsable(companyId, changes.fpaDimensionId);
  await assertSupervisorUsable(companyId, changes.supervisorId, id);

  if (changes.documentId && changes.documentId !== employee.documentId) {
    const existing = await prisma.employee.findFirst({ where: { companyId, documentId: changes.documentId, NOT: { id } } });
    if (existing) {
      throw new AppError(`Ya existe un empleado con el documento "${changes.documentId}".`, 409, 'DOCUMENT_ID_EXISTS');
    }
  }

  const touchedSensitive = Object.keys(changes).filter((key) => SENSITIVE_FIELDS.includes(key));

  return prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({ where: { id }, data: changes });
    await auditService.log(
      {
        companyId,
        userId,
        action: touchedSensitive.length > 0 ? 'employee.sensitive_info_updated' : 'employee.updated',
        entityType: 'Employee',
        entityId: id,
        oldValue: touchedSensitive.length > 0 ? Object.fromEntries(touchedSensitive.map((key) => [key, employee[key]])) : undefined,
        newValue: changes,
      },
      tx
    );
    return updated;
  });
}

async function listEmployees(companyId, { status, branchDimensionId, fpaDimensionId, search } = {}) {
  return prisma.employee.findMany({
    where: {
      companyId,
      status: status || undefined,
      branchDimensionId: branchDimensionId || undefined,
      fpaDimensionId: fpaDimensionId || undefined,
      OR: search
        ? [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { documentId: { contains: search, mode: 'insensitive' } },
            { position: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    },
    include: {
      branchDimension: { select: { id: true, name: true, code: true } },
      fpaDimension: { select: { id: true, name: true, type: true } },
      supervisor: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: 'asc' }, { firstName: 'asc' }],
  });
}

async function getEmployee(companyId, id) {
  const employee = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      branchDimension: { select: { id: true, name: true, code: true } },
      fpaDimension: { select: { id: true, name: true, type: true } },
      supervisor: { select: { id: true, firstName: true, lastName: true } },
      subordinates: { select: { id: true, firstName: true, lastName: true, position: true } },
    },
  });
  if (!employee) {
    throw new AppError('El empleado indicado no existe.', 404, 'EMPLOYEE_NOT_FOUND');
  }
  return employee;
}

module.exports = {
  createEmployee,
  updateEmployee,
  listEmployees,
  getEmployee,
  assertBranchDimensionUsable,
  assertFpaDimensionUsable,
};
