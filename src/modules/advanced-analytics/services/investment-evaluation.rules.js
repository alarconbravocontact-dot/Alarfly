const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: Valor Actual Neto (VAN/NPV). Trae a valor de hoy cada
// flujo de caja futuro del proyecto (cashFlows[0] = periodo 1,
// cashFlows[1] = periodo 2, etc.) y le resta la inversión inicial.
function calculateNpv({ initialInvestment, cashFlows, discountRate }) {
  const rate = new Decimal(discountRate);
  let npv = new Decimal(0).minus(initialInvestment);
  cashFlows.forEach((cashFlow, index) => {
    const period = index + 1;
    const discountFactor = new Decimal(1).plus(rate).pow(period);
    npv = npv.plus(new Decimal(cashFlow).dividedBy(discountFactor));
  });
  return npv;
}

// Función pura: Tasa Interna de Retorno (TIR/IRR) — la tasa de
// descuento con la que el VAN da exactamente cero. No existe una
// fórmula cerrada para despejarla (es una raíz de un polinomio de
// grado alto), así que se busca por bisección: es el mismo método que
// usan las hojas de cálculo por dentro, con una tolerancia de
// precisión razonable para uso financiero. La tasa buscada (no es un
// monto, es un porcentaje) se maneja en punto flotante estándar
// durante la búsqueda; cada VAN de prueba sí se calcula con Decimal
// exacto.
function calculateIrr({ initialInvestment, cashFlows, maxIterations = 200, tolerance = 1e-9 }) {
  let low = -0.999999;
  let high = 10; // hasta 1000% — rango generoso para cualquier caso real
  const npvAt = (rate) => calculateNpv({ initialInvestment, cashFlows, discountRate: rate });

  let npvLow = npvAt(low);
  let npvHigh = npvAt(high);

  // Si el VAN no cambia de signo en el rango buscado, no hay una TIR
  // solucionable ahí (ej. todos los flujos son negativos) — se
  // documenta como "sin TIR" en vez de devolver un número inventado.
  if (npvLow.times(npvHigh).greaterThan(0)) {
    return null;
  }

  let mid = low;
  for (let i = 0; i < maxIterations; i += 1) {
    mid = (low + high) / 2;
    const npvMid = npvAt(mid);
    if (npvMid.abs().lessThan(tolerance)) {
      return new Decimal(mid);
    }
    if (npvLow.times(npvMid).lessThan(0)) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }
  return new Decimal(mid);
}

// Función pura: Periodo de Recuperación (Payback) — en cuántos
// periodos se recupera la inversión inicial, con fracción de periodo
// cuando la recuperación cae a mitad de uno. `null` si los flujos
// dados nunca alcanzan a recuperar la inversión.
function calculatePaybackPeriod({ initialInvestment, cashFlows }) {
  let remaining = new Decimal(initialInvestment);
  for (let index = 0; index < cashFlows.length; index += 1) {
    const cashFlow = new Decimal(cashFlows[index]);
    if (cashFlow.greaterThanOrEqualTo(remaining)) {
      const fraction = remaining.dividedBy(cashFlow);
      return new Decimal(index).plus(fraction);
    }
    remaining = remaining.minus(cashFlow);
  }
  return null;
}

function evaluateInvestment({ initialInvestment, cashFlows, discountRate }) {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    throw new AppError('Necesitas al menos un flujo de caja proyectado para evaluar la inversión.', 400, 'NO_CASH_FLOWS');
  }
  const npv = calculateNpv({ initialInvestment, cashFlows, discountRate });
  const irr = calculateIrr({ initialInvestment, cashFlows });
  const paybackPeriods = calculatePaybackPeriod({ initialInvestment, cashFlows });
  return { npv, irr, paybackPeriods, isRecommended: npv.greaterThan(0) };
}

module.exports = { calculateNpv, calculateIrr, calculatePaybackPeriod, evaluateInvestment };
