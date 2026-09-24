// Glosario central: la lista de términos es texto estático (ver
// glossary-catalog.js); el valor en vivo de cada término reutiliza
// servicios ya existentes y probados de otros módulos — nunca
// recalcula nada, solo pregunta lo mismo que ya pregunta el Panel
// principal o FP&A.
//
// Fase 5: los 3 términos de dinero/CxC/CxP (antes cada uno importaba su
// propio servicio de Tesorería/AR, y "accounts-payable" ni siquiera
// tenía un servicio propio — armaba su propia consulta ad hoc acá
// mismo, duplicando lo que reports/aging.service ya calculaba) ahora
// pasan por la capa de lectura consolidada (modules/finance), que ya
// junta esos mismos números reutilizando los mismos servicios de
// siempre. `kpisService` (FP&A) se queda como está: no es un dato de
// Tesorería/CxC/CxP, y `modules/finance` no tiene ninguna razón para
// envolverlo.
const AppError = require('../utils/AppError');
const { TERMS, TERMS_BY_KEY } = require('./glossary-catalog');
const kpisService = require('../../modules/fpa/services/kpis.service');
const financeSummaryService = require('../../modules/finance/services/finance-summary.service');
const arInvoicesService = require('../../modules/accounts-receivable/services/ar-invoices.service');

// Fase 8 (sección 8): se devuelven también los campos de catálogo de
// KPI (formula/sourceRef/unit/periodicity/dimensions) cuando el
// término los tiene — nunca se calculan acá, son metadata estática de
// glossary-catalog.js.
function listTerms() {
  return TERMS.map(({ key, label, definition, hasLiveValue, formula, sourceRef, unit, periodicity, dimensions }) => ({
    key,
    label,
    definition,
    hasLiveValue,
    formula,
    sourceRef,
    unit,
    periodicity,
    dimensions,
  }));
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

async function getLiveValue(companyId, key) {
  const term = TERMS_BY_KEY.get(key);
  if (!term) throw new AppError('Ese término no existe en el glosario.', 404, 'GLOSSARY_TERM_NOT_FOUND');
  if (!term.hasLiveValue) throw new AppError('Este término no tiene un valor en vivo para mostrar.', 400, 'GLOSSARY_TERM_HAS_NO_LIVE_VALUE');

  const { from, to } = currentMonthRange();

  switch (key) {
    case 'ebitda': {
      const r = await kpisService.getEbitda(companyId, { from, to });
      return { value: r.ebitda, label: 'EBITDA de este mes' };
    }
    case 'burn-rate': {
      const r = await kpisService.getBurnRateAndRunway(companyId, { from, to });
      return { value: r.monthlyBurnRate, label: 'Tu burn rate de este mes' };
    }
    case 'runway': {
      const r = await kpisService.getBurnRateAndRunway(companyId, { from, to });
      return { value: r.runwayMonths, unit: 'meses', label: 'Tu runway actual' };
    }
    case 'liquidity-cushion': {
      const r = await financeSummaryService.getFinanceSummary(companyId);
      return { value: r.availableLiquidity, currency: r.baseCurrency, label: 'Tu colchón de liquidez actual' };
    }
    case 'accounts-receivable': {
      const r = await financeSummaryService.getFinanceSummary(companyId);
      return { value: r.totalReceivable, label: 'Tu total por cobrar ahora mismo' };
    }
    case 'accounts-payable': {
      const r = await financeSummaryService.getFinanceSummary(companyId);
      return { value: r.totalPayable, label: 'Tu total por pagar ahora mismo' };
    }
    // Fase 8: reutiliza exactamente la misma función que ya alimenta el
    // gráfico de ventas del Panel principal (getSalesTrend) — se pide
    // solo 1 mes y se toma el único balde que devuelve, en vez de
    // sumar facturas por su cuenta con una consulta nueva.
    case 'sales-this-month': {
      const trend = await arInvoicesService.getSalesTrend(companyId, { months: 1 });
      const bucket = trend[trend.length - 1];
      return { value: bucket.totalSales, label: 'Tus ventas de este mes' };
    }
    default:
      throw new AppError('Este término no tiene un valor en vivo para mostrar.', 400, 'GLOSSARY_TERM_HAS_NO_LIVE_VALUE');
  }
}

module.exports = { listTerms, getLiveValue };
