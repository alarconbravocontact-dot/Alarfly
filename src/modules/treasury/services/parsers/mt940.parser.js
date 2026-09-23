// Lector simplificado de MT940 (v1). Extrae los movimientos de las
// etiquetas :61: (monto/fecha/signo) y :86: (descripción). No cubre
// todas las variantes de formato de fecha ni los campos opcionales
// menos comunes de la especificación SWIFT.
function parseMt940(fileContent) {
  const lines = fileContent.split(/\r?\n/);
  const transactions = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith(':61:')) {
      if (current) transactions.push(current);
      const body = line.slice(4);
      // YYMMDD + fecha de entrada opcional (MMDD) + C/D + monto con coma decimal
      const match = body.match(/^(\d{6})(\d{4})?([CD])(\d+,\d{2})/);
      if (!match) {
        current = null;
        continue;
      }
      const [, valueDate, , mark, amountStr] = match;
      const year = 2000 + Number(valueDate.slice(0, 2));
      const month = valueDate.slice(2, 4);
      const day = valueDate.slice(4, 6);
      const amount = Number(amountStr.replace(',', '.'));

      current = {
        date: new Date(`${year}-${month}-${day}T00:00:00Z`),
        description: '',
        amount: mark === 'C' ? amount : -amount,
        reference: null,
        externalId: null,
        rawPayload: { line61: line },
      };
    } else if (line.startsWith(':86:') && current) {
      current.description = line.slice(4).trim();
      current.rawPayload.line86 = line;
    }
  }
  if (current) transactions.push(current);

  return transactions;
}

module.exports = { parseMt940 };
