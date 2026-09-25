// Fase 12 (secciones 5, 19, 34 — "Capas: Datos → Métricas → Detección →
// Interpretación → Recomendación → Acción" y "toda recomendación debe
// poder explicar qué detectó, con qué datos, por qué importa y qué
// recomienda"): funciones puras, sin acceso a base de datos, que
// convierten métricas YA CALCULADAS por otros módulos (nunca un
// segundo cálculo de caja/AR/AP/EBITDA — sección 6) en un "insight"
// estructurado listo para mostrarse como tarjeta. Un insight NO es un
// modelo nuevo (sección 35: "no crear este modelo si los insights
// pueden representarse con estructuras existentes") — es un objeto
// calculado al vuelo, con la misma severidad de 3 niveles que ya usa
// `core/alerts` (CRITICAL/WARNING/INFO, sección 9: "no crear otra
// taxonomía si core/alerts ya tiene una equivalente").
const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// DETECCIÓN + INTERPRETACIÓN + RECOMENDACIÓN de liquidez: reutiliza
// exactamente los campos que ya calcula `finance-summary.service.js`
// (cashOnHand, overdueReceivable, firstNegativeWeek) — nunca vuelve a
// sumar caja ni a repetir la Previsión de Liquidez. Si no hay ninguna
// semana negativa en el horizonte, no hay nada que detectar: devuelve
// `null` en vez de inventar una alerta sin evidencia real (sección 15,
// "no inventar causalidad").
function buildLiquidityInsight({ cashOnHand, overdueReceivable, firstNegativeWeek, baseCurrency }, now = new Date()) {
  if (!firstNegativeWeek) return null;

  const daysUntilNegative = Math.max(
    0,
    Math.round((new Date(firstNegativeWeek.weekStart).getTime() - now.getTime()) / MS_PER_DAY)
  );
  const overdue = new Decimal(overdueReceivable || 0);

  // Sección 9: mismo umbral que ya usan los demás detectores del
  // proyecto para "urgente" (mismo criterio de "en las próximas
  // semanas" ya documentado en Tesorería/AR) — 14 días o menos es
  // crítico, dentro del horizonte pero más lejos es advertencia.
  const severity = daysUntilNegative <= 14 ? 'CRITICAL' : 'WARNING';

  const evidence = [
    { label: 'Caja disponible hoy', value: new Decimal(cashOnHand || 0).toFixed(2), currency: baseCurrency },
    { label: 'Cuentas por cobrar vencidas', value: overdue.toFixed(2), currency: baseCurrency },
    { label: 'Saldo proyectado en esa semana', value: firstNegativeWeek.projectedBalance, currency: baseCurrency },
  ];

  return {
    type: 'liquidity',
    severity,
    title: 'Liquidez',
    // Sección 15: lenguaje que no afirma causalidad exacta cuando no
    // está demostrada — "coincide con", no "es causado por".
    description: `El saldo de caja proyectado se vuelve negativo en ${daysUntilNegative} día(s). ${
      overdue.greaterThan(0)
        ? `Esto coincide con ${overdue.toFixed(2)} ${baseCurrency} en cuentas por cobrar ya vencidas.`
        : 'No hay cuentas por cobrar vencidas registradas — la causa principal son los pagos/deuda ya programados.'
    }`,
    evidence,
    daysUntilNegative,
    action: { label: 'Ver cobros', to: '/cuentas/cobros' },
    source: 'finance-summary.service.getFinanceSummary + liquidity-forecast.service.getLiquidityForecast',
  };
}

// DETECCIÓN + RECOMENDACIÓN de cobranza: reutiliza las filas que YA
// calcula `aging.service.getReceivablesAging` (misma fuente que
// Reportes > Antigüedad de Saldos) — nunca un segundo cálculo de días
// de atraso. Solo sintetiza cuáles son los clientes con mayor saldo
// vencido, sin fabricar un "promedio histórico de pago" que no está
// respaldado por un cálculo real en el sistema (sección 15).
function buildCollectionsInsight(agingRows, { limit = 3, baseCurrency = 'USD' } = {}) {
  const overdue = agingRows.filter((row) => row.bucket !== 'CURRENT');
  if (overdue.length === 0) return null;

  const sorted = [...overdue].sort((a, b) => new Decimal(b.balance).comparedTo(new Decimal(a.balance)));
  const top = sorted.slice(0, limit).map((row) => ({
    name: row.name,
    balance: row.balance,
    currency: baseCurrency,
    daysOverdue: row.daysOverdue,
    // Mismos 3 niveles de `core/alerts` (AlertSeverity), nunca una
    // escala nueva — DAYS_90_PLUS/DAYS_61_90 son urgentes, DAYS_31_60
    // advertencia, DAYS_1_30 informativo.
    severity: row.bucket === 'DAYS_90_PLUS' || row.bucket === 'DAYS_61_90' ? 'CRITICAL' : row.bucket === 'DAYS_31_60' ? 'WARNING' : 'INFO',
  }));

  const totalOverdue = overdue.reduce((sum, row) => sum.plus(row.balance), new Decimal(0));
  const worstSeverity = top.some((c) => c.severity === 'CRITICAL')
    ? 'CRITICAL'
    : top.some((c) => c.severity === 'WARNING')
      ? 'WARNING'
      : 'INFO';

  return {
    type: 'collections',
    severity: worstSeverity,
    title: 'Cobranza',
    description: `${overdue.length} cliente(s) con saldo vencido, por un total de ${totalOverdue.toFixed(2)} ${baseCurrency}. Los de mayor prioridad:`,
    evidence: top,
    action: { label: 'Ver clientes', to: '/cuentas/clientes' },
    source: 'reports/aging.service.getReceivablesAging',
  };
}

module.exports = { buildLiquidityInsight, buildCollectionsInsight };
