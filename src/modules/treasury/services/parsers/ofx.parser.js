// Lector simplificado de OFX (v1). Cubre los campos que necesitamos de
// cada <STMTTRN>; no es un parser completo de la especificación OFX
// (no valida SGML/XML, no maneja todas las variantes de codificación).
function parseOfxDate(value) {
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

function parseOfx(fileContent) {
  const blocks = fileContent.split(/<STMTTRN>/i).slice(1);
  const transactions = [];

  for (const block of blocks) {
    const body = block.split(/<\/STMTTRN>/i)[0];
    const get = (tag) => {
      const match = body.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'));
      return match ? match[1].trim() : null;
    };

    const dtPosted = get('DTPOSTED');
    const amount = get('TRNAMT');
    if (!dtPosted || !amount) continue;

    transactions.push({
      date: parseOfxDate(dtPosted),
      description: get('NAME') || get('MEMO') || '',
      amount: Number(amount),
      reference: get('CHECKNUM') || get('REFNUM') || null,
      externalId: get('FITID') || null,
      rawPayload: { dtPosted, amount, name: get('NAME'), memo: get('MEMO'), fitid: get('FITID') },
    });
  }

  return transactions;
}

module.exports = { parseOfx };
