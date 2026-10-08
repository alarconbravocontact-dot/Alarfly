import { api } from './client';

// Membresía de la propia empresa a Alarfly (plan + pago manual con
// comprobante) — usa la sesión normal de empresa, igual que el resto
// del frontend. El servidor siempre resuelve el precio/plan reales;
// este cliente nunca los envía.
export const membershipApi = {
  listPlans: () => api.get('/membership/plans'),
  getMine: () => api.get('/membership/me'),
  listMyPayments: () => api.get('/membership/payments'),
  submitPayment: (payload) => api.post('/membership/payments', payload),
};
