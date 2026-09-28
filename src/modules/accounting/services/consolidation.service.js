const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const fxService = require('../../../core/fx/fx.service');
const reportsService = require('./reports.service');

const { Decimal } = Prisma;

// F14-E1 (corrección de seguridad): el `parentCompanyId` que llega en
// el body es un id de empresa arbitrario — que exista en la base de
// datos no significa que quien llama tenga ninguna relación con esa
// empresa. Se reutiliza `UserCompanyAccess` (el único mecanismo ya
// existente que representa "este usuario está legítimamente afiliado
// a esta empresa", el mismo que ya usa `switchActiveCompany`) como
// prueba de autorización sobre la empresa matriz elegida — nunca se
// crea un permiso nuevo. Hoy no existe ningún flujo que escriba
// `UserCompanyAccess` para una empresa ajena, así que esto bloquea por
// completo la fuga sin impedir el único caso legítimo (la propia
// empresa de origen del usuario).
async function assertAuthorizedOverCompany(userId, companyId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
  if (user?.companyId === companyId) return;

  const access = await prisma.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!access) {
    throw new AppError(
      'No tienes autorización sobre la empresa que quieres asociar como matriz.',
      403,
      'PARENT_COMPANY_NOT_AUTHORIZED'
    );
  }
}

// Marca `companyId` como subsidiaria de `parentCompanyId` (o la separa
// del grupo si se manda null). Evita ciclos simples (una empresa no
// puede ser su propia ancestro) y exige que quien llama esté
// autorizado sobre la empresa matriz elegida (ver
// `assertAuthorizedOverCompany`) — nunca solo que esa empresa exista.
async function setParentCompany(companyId, parentCompanyId, userId) {
  if (parentCompanyId === companyId) {
    throw new AppError('Una empresa no puede ser subsidiaria de sí misma.', 400, 'INVALID_PARENT_COMPANY');
  }

  if (parentCompanyId) {
    await assertAuthorizedOverCompany(userId, parentCompanyId);

    const parent = await prisma.company.findUnique({ where: { id: parentCompanyId } });
    if (!parent) {
      throw new AppError('La empresa matriz indicada no existe.', 404, 'COMPANY_NOT_FOUND');
    }

    let ancestor = parent;
    while (ancestor?.parentCompanyId) {
      if (ancestor.parentCompanyId === companyId) {
        throw new AppError('Esa relación crearía un ciclo entre empresas del grupo.', 400, 'CIRCULAR_COMPANY_GROUP');
      }
      ancestor = await prisma.company.findUnique({ where: { id: ancestor.parentCompanyId } });
    }
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({ where: { id: companyId }, data: { parentCompanyId } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'company.parent_company_changed',
        entityType: 'Company',
        entityId: companyId,
        oldValue: { parentCompanyId: company.parentCompanyId },
        newValue: { parentCompanyId },
      },
      tx
    );
    return updated;
  });
}

// F14-E8: convierte el balance de una subsidiaria a la moneda base de
// la matriz antes de sumarlo — antes de este fix, `combined` sumaba
// `row.balance` de cada empresa sin mirar `baseCurrency` en absoluto,
// así que un grupo con una subsidiaria en otra moneda (ej. matriz USD,
// subsidiaria EUR) mezclaba unidades distintas en el mismo total sin
// ningún aviso. Mismo criterio ya probado y usado por
// `treasury/services/treasury-accounts.service.convertToBase` para la
// posición de caja consolidada — reimplementado acá como un ayudante
// local minúsculo (no una importación cruzada `accounting → treasury`,
// que invertiría el orden de construcción documentado del proyecto:
// Core → Contabilidad → Tesorería) sobre la MISMA fuente de verdad de
// tasas (`core/fx.getLatestRate`), nunca una segunda rutina de FX. La
// tasa se busca en el registro de la propia MATRIZ (mismo sentido que
// ya usa `revalueAccount`: "cuántas unidades de mi moneda base equivale
// 1 unidad de esta moneda extranjera") — si no hay tasa registrada,
// nunca se inventa una: esa empresa se excluye del total y se reporta
// en `currenciesWithoutRate`, igual que ya hace `missingRates` en la
// posición de caja consolidada.
// Devuelve el factor de conversión (un Decimal) de `currency` a
// `parentCurrency`, o `null` si no hay tasa registrada — se resuelve
// UNA sola vez por empresa (nunca por línea) para no repetir la misma
// consulta decenas de veces sobre el mismo balance de comprobación.
async function resolveConversionFactor(parentCompanyId, parentCurrency, currency, asOfDate) {
  if (currency === parentCurrency) return new Decimal(1);
  try {
    const rate = await fxService.getLatestRate(parentCompanyId, currency, asOfDate);
    return new Decimal(rate.rate);
  } catch {
    return null;
  }
}

// Suma el balance de comprobación de una empresa matriz y sus
// subsidiarias directas, código de cuenta por código de cuenta, y
// excluye automáticamente las cuentas marcadas como inter-compañía
// (para no duplicar un saldo que ya está contado en la otra empresa).
// Simplificación consciente: asume que las empresas del grupo comparten
// la misma estructura de códigos de cuenta (ej: aplicaron la misma
// plantilla de plan de cuentas) y solo consolida subsidiarias directas
// (un nivel) — documentado como límite consciente, sin caso de uso
// real de grupos multinivel todavía.
async function getConsolidatedTrialBalance(parentCompanyId, asOfDate) {
  const parent = await prisma.company.findUnique({ where: { id: parentCompanyId } });
  if (!parent) {
    throw new AppError('La empresa matriz indicada no existe.', 404, 'COMPANY_NOT_FOUND');
  }

  const subsidiaries = await prisma.company.findMany({ where: { parentCompanyId } });
  const companies = [parent, ...subsidiaries];

  const combined = new Map();
  let intercompanyEliminated = new Decimal(0);
  const eliminatedDetail = [];
  const currenciesWithoutRate = [];

  for (const company of companies) {
    const [report, accounts] = await Promise.all([
      reportsService.getTrialBalance(company.id, asOfDate),
      prisma.account.findMany({ where: { companyId: company.id }, select: { id: true, isIntercompany: true } }),
    ]);
    const isIntercompanyById = new Map(accounts.map((a) => [a.id, a.isIntercompany]));

    const conversionFactor = await resolveConversionFactor(parentCompanyId, parent.baseCurrency, company.baseCurrency, asOfDate);
    if (conversionFactor === null) {
      currenciesWithoutRate.push({ companyId: company.id, companyName: company.name, currency: company.baseCurrency });
      continue;
    }

    for (const row of report.rows) {
      const balance = new Decimal(row.balance).times(conversionFactor);

      if (isIntercompanyById.get(row.accountId)) {
        intercompanyEliminated = intercompanyEliminated.plus(balance);
        eliminatedDetail.push({ companyId: company.id, companyName: company.name, code: row.code, name: row.name, balance: balance.toFixed(2) });
        continue;
      }
      const existing = combined.get(row.code) || { code: row.code, name: row.name, balance: new Decimal(0) };
      existing.balance = existing.balance.plus(balance);
      combined.set(row.code, existing);
    }
  }

  const rows = [...combined.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((row) => ({ code: row.code, name: row.name, balance: row.balance.toFixed(2) }));

  return {
    parentCompany: { id: parent.id, name: parent.name, baseCurrency: parent.baseCurrency },
    companiesIncluded: companies
      .filter((company) => !currenciesWithoutRate.some((c) => c.companyId === company.id))
      .map((company) => ({ id: company.id, name: company.name })),
    asOfDate,
    rows,
    intercompanyEliminated: intercompanyEliminated.toFixed(2),
    // Detalle línea por línea de qué cuenta de qué empresa se excluyó
    // (además del total ya existente en `intercompanyEliminated`) —
    // agregado para el punto 5 de Reportes, que necesita mostrar el
    // detalle de eliminaciones, no solo el total.
    eliminatedDetail: eliminatedDetail.sort((a, b) => a.code.localeCompare(b.code)),
    // F14-E8: empresas del grupo cuya moneda no pudo convertirse a la
    // de la matriz por falta de una tasa registrada — quedaron
    // excluidas del total en vez de mezclar unidades distintas.
    currenciesWithoutRate,
  };
}

module.exports = { getConsolidatedTrialBalance, setParentCompany };
