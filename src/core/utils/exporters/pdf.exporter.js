const PDFDocument = require('pdfkit');

// Genera un PDF tabular genérico: un título y una tabla de
// columnas/filas ya aplanada por quien lo llama — este exportador no
// sabe nada de estados financieros ni de ningún módulo, solo dibuja
// texto en columnas.
function build(title, columns, rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(title, { align: 'left' });
    doc.moveDown();

    const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columns.length;

    doc.fontSize(9).font('Helvetica-Bold');
    const headerY = doc.y;
    columns.forEach((col, i) => {
      doc.text(col.label, doc.page.margins.left + i * columnWidth, headerY, { width: columnWidth });
    });
    doc.moveDown();
    doc.font('Helvetica');

    for (const row of rows) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
      const rowY = doc.y;
      columns.forEach((col, i) => {
        const value = row[col.key] === undefined || row[col.key] === null ? '' : String(row[col.key]);
        doc.text(value, doc.page.margins.left + i * columnWidth, rowY, { width: columnWidth });
      });
      doc.moveDown(0.6);
    }

    doc.end();
  });
}

module.exports = { build };
