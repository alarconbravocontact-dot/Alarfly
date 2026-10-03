// Única fuente de verdad de etiquetas/tonos/transiciones de estado de
// comisión en el frontend — usada tanto por el tablero del propio
// afiliado (solo lectura) como por la administración cruzada (que
// además necesita saber a qué estados se puede pasar). Espejo exacto
// del mapa `ALLOWED_COMMISSION_TRANSITIONS` de
// core/affiliates/affiliates.rules.js en el backend — el backend
// sigue siendo quien de verdad valida cada transición; esto solo evita
// ofrecer en la interfaz un botón que el servidor rechazaría igual.
export const COMMISSION_STATUS_LABELS = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  PAYABLE: 'Lista para pagar',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};

export const COMMISSION_STATUS_TONE = {
  PENDING: 'warning',
  APPROVED: 'positive',
  PAYABLE: 'positive',
  PAID: 'positive',
  CANCELLED: 'negative',
};

export const ALLOWED_COMMISSION_TRANSITIONS = {
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PAYABLE', 'CANCELLED'],
  PAYABLE: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};
