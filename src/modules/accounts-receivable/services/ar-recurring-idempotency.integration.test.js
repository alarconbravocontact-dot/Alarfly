// Fase 1 — prueba de integración contra Postgres real: confirma que
// generar una factura desde una plantilla recurrente y marcar
// `lastGeneratedAt` quedan en una sola transacción, cerrando el riesgo
// de duplicado que la auditoría encontró (si el proceso fallaba entre
// ambos pasos, el próximo cron veía la plantilla como "todavía vencida"
// y generaba una segunda factura para el mismo periodo).
const {
  prisma,
  buildTreasuryScenario,
  createAccount,
  createTaxJurisdiction,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const arRecurringService = require('./ar-recurring.service');

let scenario;
let incomeAccount;
let jurisdiction;
let template;

beforeAll(async () => {
  scenario = await buildTreasuryScenario();
  incomeAccount = await createAccount(scenario.company.id, { type: 'INCOME', normalBalance: 'CREDIT' });
  jurisdiction = await createTaxJurisdiction(scenario.company.id);

  template = await prisma.arRecurringInvoiceTemplate.create({
    data: {
      companyId: scenario.company.id,
      customerId: scenario.customer.id,
      jurisdictionId: jurisdiction.id,
      incomeAccountId: incomeAccount.id,
      linesSnapshot: [{ description: 'Suscripción mensual', quantity: 1, unitPrice: 50 }],
      createdByUserId: scenario.user.id,
      lastGeneratedAt: null,
    },
  });
});

afterAll(async () => {
  await prisma.arRecurringInvoiceTemplate.deleteMany({ where: { companyId: scenario.company.id } });
  await cleanupCompany(scenario.company.id);
  await prisma.$disconnect();
});

test('genera la factura y marca lastGeneratedAt de forma atómica', async () => {
  const invoice = await arRecurringService.generateFromTemplate(template);

  expect(invoice.id).toBeDefined();

  const storedTemplate = await prisma.arRecurringInvoiceTemplate.findUnique({ where: { id: template.id } });
  expect(storedTemplate.lastGeneratedAt).not.toBeNull();

  const storedInvoice = await prisma.arInvoice.findUnique({ where: { id: invoice.id } });
  expect(storedInvoice).not.toBeNull();
});

test('runDueTemplates no genera una segunda factura para el mismo periodo aunque se corra dos veces seguidas', async () => {
  const freshTemplate = await prisma.arRecurringInvoiceTemplate.create({
    data: {
      companyId: scenario.company.id,
      customerId: scenario.customer.id,
      jurisdictionId: jurisdiction.id,
      incomeAccountId: incomeAccount.id,
      linesSnapshot: [{ description: 'Suscripción mensual', quantity: 1, unitPrice: 30 }],
      createdByUserId: scenario.user.id,
      lastGeneratedAt: null,
    },
  });

  const firstRun = await arRecurringService.runDueTemplates(scenario.company.id);
  const secondRun = await arRecurringService.runDueTemplates(scenario.company.id);

  const generatedForTemplate = [...firstRun, ...secondRun].filter((r) => r.templateId === freshTemplate.id);
  expect(generatedForTemplate).toHaveLength(1); // solo la primera corrida generó factura

  const invoicesForCustomer = await prisma.arInvoice.count({
    where: { companyId: scenario.company.id, customerId: scenario.customer.id, subtotal: 30 },
  });
  expect(invoicesForCustomer).toBe(1);
});
