require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/core/database/prisma');
const templatesService = require('../src/modules/accounting/services/account-templates.service');
const periodLockService = require('../src/core/period-lock/period-lock.service');

// Plan de cuentas estándar de ejemplo (numeración estilo PUC), con
// jerarquía de 3 niveles para demostrar que no hay límite de profundidad.
const STANDARD_TEMPLATE_LINES = [
  { code: '1', name: 'Activo', type: 'ASSET', normalBalance: 'DEBIT', isPostable: false, order: 1 },
  { code: '11', name: 'Activo Corriente', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1', isPostable: false, order: 2 },
  { code: '1105', name: 'Caja', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '11', financialStatementSection: 'ACTIVO_CORRIENTE', order: 3 },
  { code: '1110', name: 'Bancos', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '11', financialStatementSection: 'ACTIVO_CORRIENTE', order: 4 },
  { code: '1205', name: 'Cuentas por Cobrar Clientes', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '11', financialStatementSection: 'ACTIVO_CORRIENTE', order: 5 },
  { code: '1435', name: 'Inventario', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '11', financialStatementSection: 'ACTIVO_CORRIENTE', order: 6 },
  { code: '15', name: 'Activo No Corriente', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1', isPostable: false, order: 7 },
  { code: '1504', name: 'Equipo de Oficina', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '15', financialStatementSection: 'ACTIVO_NO_CORRIENTE', order: 8 },
  { code: '1592', name: 'Depreciación Acumulada', type: 'ASSET', normalBalance: 'CREDIT', parentCode: '15', financialStatementSection: 'ACTIVO_NO_CORRIENTE', order: 9 },

  { code: '2', name: 'Pasivo', type: 'LIABILITY', normalBalance: 'CREDIT', isPostable: false, order: 10 },
  { code: '21', name: 'Pasivo Corriente', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2', isPostable: false, order: 11 },
  { code: '2105', name: 'Cuentas por Pagar Proveedores', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '21', financialStatementSection: 'PASIVO_CORRIENTE', order: 12 },
  { code: '2365', name: 'Impuestos por Pagar', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '21', financialStatementSection: 'PASIVO_CORRIENTE', order: 13 },
  { code: '25', name: 'Pasivo No Corriente', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2', isPostable: false, order: 14 },
  { code: '2505', name: 'Préstamos por Pagar Largo Plazo', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '25', financialStatementSection: 'PASIVO_NO_CORRIENTE', order: 15 },

  { code: '3', name: 'Patrimonio', type: 'EQUITY', normalBalance: 'CREDIT', isPostable: false, order: 16 },
  { code: '3105', name: 'Capital Social', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3', financialStatementSection: 'PATRIMONIO', order: 17 },
  { code: '3605', name: 'Utilidades Retenidas', type: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3', financialStatementSection: 'PATRIMONIO', order: 18 },

  { code: '4', name: 'Ingresos', type: 'INCOME', normalBalance: 'CREDIT', isPostable: false, order: 19 },
  { code: '4135', name: 'Ventas', type: 'INCOME', normalBalance: 'CREDIT', parentCode: '4', financialStatementSection: 'INGRESO_OPERACIONAL', order: 20 },
  { code: '4210', name: 'Ingresos No Operacionales', type: 'INCOME', normalBalance: 'CREDIT', parentCode: '4', financialStatementSection: 'INGRESO_NO_OPERACIONAL', order: 21 },

  { code: '5', name: 'Gastos', type: 'EXPENSE', normalBalance: 'DEBIT', isPostable: false, order: 22 },
  { code: '51', name: 'Gastos Operacionales', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5', isPostable: false, order: 23 },
  { code: '5105', name: 'Gastos de Personal', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '51', financialStatementSection: 'GASTO_OPERACIONAL', order: 24 },
  { code: '5135', name: 'Servicios', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '51', financialStatementSection: 'GASTO_OPERACIONAL', order: 25 },
  { code: '5160', name: 'Depreciaciones', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '51', financialStatementSection: 'GASTO_OPERACIONAL', order: 26 },
  { code: '53', name: 'Gastos No Operacionales', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5', isPostable: false, order: 27 },
  { code: '5305', name: 'Gastos Financieros', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '53', financialStatementSection: 'GASTO_NO_OPERACIONAL', order: 28 },

  { code: '6', name: 'Costo de Ventas', type: 'EXPENSE', normalBalance: 'DEBIT', isPostable: false, order: 29 },
  { code: '6135', name: 'Costo de Ventas', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6', financialStatementSection: 'COSTO_VENTAS', order: 30 },
];

async function seedTemplate() {
  const existing = await prisma.accountTemplate.findFirst({ where: { name: 'Plan de Cuentas Estándar' } });
  if (existing) return existing;

  return prisma.accountTemplate.create({
    data: {
      name: 'Plan de Cuentas Estándar',
      description: 'Plantilla base con Activo, Pasivo, Patrimonio, Ingresos y Gastos.',
      lines: { create: STANDARD_TEMPLATE_LINES },
    },
  });
}

async function seedCompanyAndUsers() {
  const existing = await prisma.company.findFirst({ where: { name: 'Empresa Demo' } });
  if (existing) return existing;

  const company = await prisma.company.create({
    data: { name: 'Empresa Demo', taxId: '900123456-1', baseCurrency: 'USD' },
  });

  await prisma.accountingSettings.create({
    data: { companyId: company.id, requiresApprovalForManualEntries: true },
  });

  const passwordHash = await bcrypt.hash('Demo1234!', 10);

  await prisma.user.createMany({
    data: [
      // Fase Afiliados / Membresía: el Admin Demo también queda como el
      // primer administrador de plataforma de ambos programas (afiliados
      // y membresías) — mismo criterio que ya usa el proyecto para
      // cualquier "primer administrador de algo sensible" (ej. Niveles
      // de Acceso): no hay un camino self-service para volverse el
      // primero, se otorga acá.
      { companyId: company.id, name: 'Admin Demo', email: 'admin@demo.alarfly.com', passwordHash, role: 'ADMIN', isAffiliateProgramAdmin: true, isMembershipAdmin: true },
      { companyId: company.id, name: 'Contador Demo', email: 'contador@demo.alarfly.com', passwordHash, role: 'ACCOUNTANT' },
      { companyId: company.id, name: 'Financiero Demo', email: 'financiero@demo.alarfly.com', passwordHash, role: 'FINANCE' },
      { companyId: company.id, name: 'Colaborador Demo', email: 'colaborador@demo.alarfly.com', passwordHash, role: 'COLLABORATOR' },
    ],
  });

  return company;
}

async function seedOpenPeriod(companyId) {
  // Cierre Total: esta misma lógica se extrajo a
  // `core/period-lock.createInitialOpenPeriod` para que el registro
  // público real (`auth.service.signup`) la reutilice — el seed ahora
  // solo la llama, en vez de mantener su propia copia del cálculo.
  return periodLockService.createInitialOpenPeriod(companyId);
}

async function seedTreasuryAccount(companyId) {
  await prisma.treasurySettings.upsert({
    where: { companyId },
    update: {},
    create: { companyId },
  });

  const existing = await prisma.treasuryAccount.findFirst({ where: { companyId, name: 'Banco Principal' } });
  if (existing) return existing;

  const bankGlAccount = await prisma.account.findUnique({ where: { companyId_code: { companyId, code: '1110' } } });

  return prisma.treasuryAccount.create({
    data: {
      companyId,
      type: 'BANK_ACCOUNT',
      name: 'Banco Principal',
      currency: 'USD',
      bankName: 'Banco Demo',
      accountNumber: '0001-2222-33',
      glAccountId: bankGlAccount.id,
    },
  });
}

async function main() {
  const template = await seedTemplate();
  const company = await seedCompanyAndUsers();

  const accountCount = await prisma.account.count({ where: { companyId: company.id } });
  if (accountCount === 0) {
    const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN' } });
    await templatesService.applyTemplate(company.id, template.id, admin.id);
  }

  const period = await seedOpenPeriod(company.id);
  const treasuryAccount = await seedTreasuryAccount(company.id);

  console.log('Datos de prueba listos:');
  console.log(`  Empresa: ${company.name} (${company.id})`);
  console.log('  Usuarios (contraseña para todos: Demo1234!):');
  console.log('    admin@demo.alarfly.com (ADMIN)');
  console.log('    contador@demo.alarfly.com (ACCOUNTANT)');
  console.log('    financiero@demo.alarfly.com (FINANCE)');
  console.log('    colaborador@demo.alarfly.com (COLLABORATOR)');
  console.log(`  Periodo abierto: ${period.name}`);
  console.log(`  Cuenta de tesorería demo: ${treasuryAccount.name} (${treasuryAccount.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
