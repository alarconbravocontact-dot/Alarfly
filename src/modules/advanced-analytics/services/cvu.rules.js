const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

const DEFAULT_VOLUME_MULTIPLIERS = ['0.5', '0.75', '1', '1.25', '1.5'];

// Función pura: extiende el Punto de Equilibrio simulando distintos
// niveles de venta. Asume que el costo variable escala en proporción
// directa al ingreso (misma proporción variable/ingreso de hoy) y que
// el costo fijo no cambia — simplificación estándar de un análisis
// Costo-Volumen-Utilidad de corto plazo.
function projectCvuScenarios({ totalRevenue, fixedCosts, variableCosts, volumeMultipliers = DEFAULT_VOLUME_MULTIPLIERS }) {
  const revenue = new Decimal(totalRevenue);
  const fixed = new Decimal(fixedCosts);
  const variable = new Decimal(variableCosts);

  return volumeMultipliers.map((multiplierInput) => {
    const multiplier = new Decimal(multiplierInput);
    const projectedRevenue = revenue.times(multiplier);
    const projectedVariableCosts = variable.times(multiplier);
    const projectedProfit = projectedRevenue.minus(projectedVariableCosts).minus(fixed);
    return {
      volumeMultiplier: multiplier,
      projectedRevenue,
      projectedVariableCosts,
      fixedCosts: fixed,
      projectedProfit,
    };
  });
}

module.exports = { projectCvuScenarios, DEFAULT_VOLUME_MULTIPLIERS };
