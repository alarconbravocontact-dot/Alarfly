// Fase 11 (sección 14, "Audit filters"): prueba contra Postgres real
// que `listForCompany` filtra por `action` (nuevo) y respeta el límite
// (sección 27, performance) sin tocar `listForEntity`/`listForEntities`,
// que siguen igual.
const { prisma, createCompany, createUser, cleanupCompany } = require('../../test-helpers/integration-fixtures');
const auditService = require('./audit.service');

let company;
let user;

beforeEach(async () => {
  company = await createCompany();
  user = await createUser(company.id);
});

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { companyId: company.id } });
  await cleanupCompany(company.id);
});

describe('core/audit — filtros y límite (Fase 11)', () => {
  test('listForCompany filtra por action', async () => {
    await auditService.log({
      companyId: company.id,
      userId: user.id,
      action: 'journal_entry.created',
      entityType: 'JournalEntry',
      entityId: 'e1',
    });
    await auditService.log({
      companyId: company.id,
      userId: user.id,
      action: 'journal_entry.approved',
      entityType: 'JournalEntry',
      entityId: 'e1',
    });

    const created = await auditService.listForCompany(company.id, { action: 'journal_entry.created' });
    expect(created).toHaveLength(1);
    expect(created[0].action).toBe('journal_entry.created');

    const all = await auditService.listForCompany(company.id, {});
    expect(all).toHaveLength(2);
  });

  test('listForCompany nunca devuelve más filas que el límite pedido (tope 1000)', async () => {
    for (let i = 0; i < 5; i += 1) {
      await auditService.log({
        companyId: company.id,
        userId: user.id,
        action: 'test.action',
        entityType: 'Test',
        entityId: `e${i}`,
      });
    }

    const limited = await auditService.listForCompany(company.id, { limit: 2 });
    expect(limited).toHaveLength(2);

    const overLimit = await auditService.listForCompany(company.id, { limit: 5000 });
    expect(overLimit.length).toBeLessThanOrEqual(1000);
  });

  test('el aislamiento multiempresa se mantiene: otra empresa nunca ve estas filas', async () => {
    const otherCompany = await createCompany();
    await auditService.log({
      companyId: company.id,
      userId: user.id,
      action: 'test.action',
      entityType: 'Test',
      entityId: 'e1',
    });

    const otherCompanyLogs = await auditService.listForCompany(otherCompany.id, {});
    expect(otherCompanyLogs).toHaveLength(0);

    await cleanupCompany(otherCompany.id);
  });
});
