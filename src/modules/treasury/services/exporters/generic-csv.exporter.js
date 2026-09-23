function csvEscape(value) {
  const str = String(value ?? '');
  return /[,"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Formato genérico, no atado a ningún banco/país en particular. Sirve
// como plantilla base hasta que haya demanda real de un formato
// específico (ACH/SEPA), momento en el que se agrega otra función acá
// y una entrada en el registro de exporters/index.js.
function exportGenericCsv(paymentOrders) {
  const header = ['payeeName', 'payeeBankName', 'payeeAccountNumber', 'amount', 'currency', 'scheduledDate', 'description', 'reference'];
  const rows = paymentOrders.map((order) =>
    [
      order.payeeName,
      order.payeeBankName || '',
      order.payeeAccountNumber || '',
      order.amount.toString(),
      order.currency,
      order.scheduledDate.toISOString().slice(0, 10),
      order.description,
      order.id,
    ]
      .map(csvEscape)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
}

module.exports = { exportGenericCsv };
