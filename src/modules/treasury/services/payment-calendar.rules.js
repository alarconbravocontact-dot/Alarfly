const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

function toDateKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Función pura: agrupa documentos (facturas de compra, cuotas de deuda,
// órdenes de pago — cualquiera con `date`/`amount`) por día calendario,
// sumando el monto y contando cuántos caen ese día — la base para
// ubicar "cada documento" en su fecha de vencimiento y para detectar
// concentración.
function groupDocumentsByDay(documents) {
  const groups = new Map();
  for (const doc of documents) {
    const key = toDateKey(doc.date);
    if (!groups.has(key)) groups.set(key, { date: key, totalAmount: new Decimal(0), count: 0, documents: [] });
    const group = groups.get(key);
    group.totalAmount = group.totalAmount.plus(doc.amount);
    group.count += 1;
    group.documents.push(doc);
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, totalAmount: g.totalAmount.toFixed(2) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Función pura: un día tiene "concentración alta de pagos" si su monto
// total supera un múltiplo configurable del promedio diario del
// horizonte (solo contando días que sí tienen pagos, para que un
// horizonte con pocos días de pago no infle el promedio hacia abajo
// y marque casi todo como "alto"), o si junta muchos documentos
// distintos el mismo día — cualquiera de los dos criterios ya es una
// señal real de "revisa este día con cuidado".
function detectHighConcentrationDays(dayGroups, { amountMultiplier = 2, minCount = 3 } = {}) {
  const daysWithPayments = dayGroups.filter((d) => d.count > 0);
  if (daysWithPayments.length === 0) return [];

  const total = daysWithPayments.reduce((sum, d) => sum.plus(d.totalAmount), new Decimal(0));
  const average = total.dividedBy(daysWithPayments.length);
  const threshold = average.times(amountMultiplier);

  return daysWithPayments.filter((d) => new Decimal(d.totalAmount).greaterThanOrEqualTo(threshold) || d.count >= minCount).map((d) => d.date);
}

module.exports = { toDateKey, groupDocumentsByDay, detectHighConcentrationDays };
