const { daysUntil } = require('../../../core/alerts/alerts.rules');

// Función pura: convierte las filas reales de AuditLog (nunca un
// cálculo aparte, ver CLAUDE.md) en pasos legibles de la línea de
// tiempo de una factura — cada paso ya viene con quién lo hizo, cuándo,
// y el documento relacionado si aplica (ej. "vía Nota de Crédito #045").
// `context` trae los datos ya cargados por el servicio (aplicaciones de
// pago de ESTA factura por paymentId, notas de crédito/débito por id)
// para no tener que volver a consultar la base de datos acá.
function buildInvoiceTimelineSteps(auditEntries, context) {
  const { paymentApplicationsByPaymentId, creditNotesById } = context;

  return auditEntries
    .map((entry) => {
      const userName = entry.user ? entry.user.name : 'Sistema';
      const base = { auditLogId: entry.id, date: entry.createdAt, userName, action: entry.action };

      if (entry.entityType === 'ArInvoice' && entry.action === 'ar_invoice.created') {
        return { ...base, label: 'Factura registrada', relatedDocument: null };
      }

      if (entry.entityType === 'ArPayment') {
        const application = paymentApplicationsByPaymentId[entry.entityId];
        const amount = application ? application.amount : null;
        const label = entry.action === 'ar_payment.advance_applied' ? 'Anticipo aplicado' : 'Cobro aplicado';
        return {
          ...base,
          label: amount != null ? `${label} (${amount})` : label,
          relatedDocument: `Cobro #${entry.entityId.slice(-6)}`,
        };
      }

      if (entry.entityType === 'ArCreditNote') {
        const note = creditNotesById[entry.entityId];
        const typeLabel = note?.type === 'DEBIT' ? 'Nota de débito' : 'Nota de crédito';
        return {
          ...base,
          label: `${typeLabel} aplicada`,
          relatedDocument: note ? `${typeLabel} #${note.noteNumber}` : null,
        };
      }

      return { ...base, label: entry.action, relatedDocument: null };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Función pura: días entre el primer paso (creación) y el segundo paso
// real (el primer movimiento posterior) — null si todavía no hubo
// ningún movimiento después de crearse.
function computeFirstActionGapDays(steps) {
  if (steps.length < 2) return null;
  return daysUntil(steps[1].date, steps[0].date);
}

// Función pura: compara el gap actual contra el promedio histórico de
// ESE MISMO cliente (mismo criterio de "mejor no sugerir que sugerir
// mal" ya usado en la detección de recurrencia de facturas) — hacen
// falta al menos `minSamples` facturas históricas con su propio primer
// movimiento para poder hablar de un "promedio", y el gap actual debe
// superar `multiplier` veces ese promedio para marcarse como anomalía.
function detectUnusualDelay(currentGapDays, historicalGapsDays, { multiplier = 2, minSamples = 2 } = {}) {
  const samples = historicalGapsDays.filter((g) => g != null);
  if (currentGapDays == null || samples.length < minSamples) {
    return { isAnomaly: false, averageDays: null };
  }
  const averageDays = samples.reduce((sum, g) => sum + g, 0) / samples.length;
  // Sin "if averageDays <= 0, nunca hay anomalía": un cliente que
  // siempre reacciona el mismo día (promedio 0) y de pronto tarda
  // varios días también es una desviación real de su patrón — el
  // propio multiplicador ya la detecta sin necesitar un caso especial
  // (0 × multiplier sigue siendo 0, así que cualquier gap positivo
  // sobre un promedio de 0 califica).
  return { isAnomaly: currentGapDays > averageDays * multiplier, averageDays };
}

module.exports = { buildInvoiceTimelineSteps, computeFirstActionGapDays, detectUnusualDelay };
