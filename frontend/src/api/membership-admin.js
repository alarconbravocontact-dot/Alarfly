import { api } from './client';

// Administración cruzada de pagos de membresía — mismo criterio que
// `affiliate-admin.js`: usa la sesión normal de empresa, el backend es
// quien de verdad decide si este usuario puede entrar
// (requireMembershipAdmin); `amIAdmin()` solo decide si se muestra el
// enlace en la navegación.
export const membershipAdminApi = {
  amIAdmin: () => api.get('/membership-admin/am-i-admin'),
  listPendingPayments: () => api.get('/membership-admin/payments'),
  getPaymentProof: (id) => api.get(`/membership-admin/payments/${id}/proof`),
  decidePayment: (id, approve, note) => api.patch(`/membership-admin/payments/${id}/decide`, { approve, note }),
};
