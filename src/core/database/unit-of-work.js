const prisma = require('./prisma');

// Unit of Work de Alarfly (Fase 1). No es un motor de transacciones
// nuevo: es el mismo prisma.$transaction de siempre, con una sola forma
// de threading para que una operación de negocio, el Ledger, Tesorería/
// AR/AP/Inventario y la auditoría puedan compartir una única transacción
// atómica — todo aplicado o nada aplicado. El patrón ya existía de forma
// aislada (audit.service.log(data, tx = prisma), ar-ap-settings
// getNextArInvoiceNumber(companyId, tx)): esto solo lo generaliza y lo
// aplica también al Ledger, que era la pieza que faltaba.
//
// Uso: si el llamador ya participa de una transacción externa (la recibe
// como `tx`), la reutiliza. Si no, abre una transacción nueva — mismo
// comportamiento de siempre para quien no pasa `tx`.
async function withTransaction(work, tx = null) {
  if (tx) return work(tx);
  return prisma.$transaction(work);
}

module.exports = { withTransaction };
