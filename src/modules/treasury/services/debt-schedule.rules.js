const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

function addMonths(date, months) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

// Función pura: genera el cronograma de cuotas por el método de capital
// constante (cada cuota amortiza el mismo capital; el interés baja
// porque se calcula sobre el saldo restante, no sobre el original). La
// última cuota se ajusta al saldo exacto que quede, para no arrastrar
// centavos de redondeo.
function generateInstallmentSchedule({ principalAmount, interestRate, installmentCount, startDate }) {
  const principal = new Decimal(principalAmount);
  const monthlyRate = new Decimal(interestRate).div(100).div(12);
  const principalPerInstallment = principal.dividedBy(installmentCount).toDecimalPlaces(2);

  const schedule = [];
  let remainingBalance = principal;

  for (let i = 1; i <= installmentCount; i++) {
    const interestPortion = remainingBalance.times(monthlyRate).toDecimalPlaces(2);
    const principalPortion = i === installmentCount ? remainingBalance : principalPerInstallment;

    schedule.push({
      installmentNumber: i,
      dueDate: addMonths(startDate, i),
      principalPortion,
      interestPortion,
    });

    remainingBalance = remainingBalance.minus(principalPortion);
  }

  return schedule;
}

module.exports = { generateInstallmentSchedule };
