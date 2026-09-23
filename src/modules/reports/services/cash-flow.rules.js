const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Función pura: arma el Estado de Flujo de Efectivo (método indirecto) a
// partir de los movimientos (débito/crédito) de cada "balde" de cuentas
// en el periodo. No consulta la base de datos ni recalcula partida doble
// — solo suma lo que el servicio ya trajo de Contabilidad/Tesorería.
//
// La identidad contable de la que se parte (y que esta función NUNCA
// puede romper, por construcción):
//   ΔActivos = ΔPasivos + ΔPatrimonio + UtilidadDelPeriodo
// Separando Activos en {Efectivo, ActivoFijoBruto, DepreciaciónAcumulada,
// OtrosActivosOperativos} y Pasivos en {Deuda, OtrosPasivosOperativos}:
//   ΔEfectivo = UtilidadDelPeriodo
//             + ΔDepreciaciónAcumulada (crédito neto, "se agrega de vuelta")
//             - ΔActivoFijoBruto (débito neto, "inversión")
//             - ΔOtrosActivosOperativos (débito neto)
//             + ΔOtrosPasivosOperativos (crédito neto)
//             + ΔDeuda (crédito neto, "financiamiento")
//             + ΔPatrimonio (crédito neto, "financiamiento")
// Por eso, si el Balance General está bien calculado (ver bug corregido
// en accounting/reports.service.getBalanceSheet), el resultado de esta
// función SIEMPRE cuadra exactamente contra el cambio real de efectivo.
function buildIndirectCashFlow({
  netIncomePeriod,
  cashDebit,
  cashCredit,
  fixedAssetDebit,
  fixedAssetCredit,
  accumDepDebit,
  accumDepCredit,
  debtDebit,
  debtCredit,
  otherOpAssetDebit,
  otherOpAssetCredit,
  otherOpLiabDebit,
  otherOpLiabCredit,
  equityDebit,
  equityCredit,
}) {
  const netIncome = new Decimal(netIncomePeriod);
  const actualCashDelta = new Decimal(cashDebit).minus(cashCredit);

  const depreciationAddback = new Decimal(accumDepCredit).minus(accumDepDebit);
  const otherOpAssetDelta = new Decimal(otherOpAssetDebit).minus(otherOpAssetCredit);
  const otherOpLiabDelta = new Decimal(otherOpLiabCredit).minus(otherOpLiabDebit);
  const netCashFromOperating = netIncome.plus(depreciationAddback).minus(otherOpAssetDelta).plus(otherOpLiabDelta);

  const fixedAssetDelta = new Decimal(fixedAssetDebit).minus(fixedAssetCredit);
  const netCashFromInvesting = fixedAssetDelta.negated();

  const debtDelta = new Decimal(debtCredit).minus(debtDebit);
  const equityDelta = new Decimal(equityCredit).minus(equityDebit);
  const netCashFromFinancing = debtDelta.plus(equityDelta);

  const netChangeInCash = netCashFromOperating.plus(netCashFromInvesting).plus(netCashFromFinancing);

  return {
    operating: {
      netIncome: netIncome.toFixed(2),
      depreciationAddback: depreciationAddback.toFixed(2),
      changeInOtherOperatingAssets: otherOpAssetDelta.negated().toFixed(2),
      changeInOtherOperatingLiabilities: otherOpLiabDelta.toFixed(2),
      total: netCashFromOperating.toFixed(2),
    },
    investing: {
      changeInFixedAssets: netCashFromInvesting.toFixed(2),
      total: netCashFromInvesting.toFixed(2),
    },
    financing: {
      changeInDebt: debtDelta.toFixed(2),
      changeInEquity: equityDelta.toFixed(2),
      total: netCashFromFinancing.toFixed(2),
    },
    netChangeInCash: netChangeInCash.toFixed(2),
    actualCashDelta: actualCashDelta.toFixed(2),
    reconciles: netChangeInCash.equals(actualCashDelta),
  };
}

module.exports = { buildIndirectCashFlow };
