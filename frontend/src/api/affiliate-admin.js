import { api } from './client';

// Administración cruzada del programa de afiliados — usa la sesión
// normal de empresa (el cliente HTTP compartido de siempre), nunca la
// sesión de afiliado. El backend es quien de verdad decide si este
// usuario puede entrar (requireAffiliateProgramAdmin); `amIAdmin()`
// solo se usa para decidir si se muestra el enlace en la navegación.
export const affiliateAdminApi = {
  amIAdmin: () => api.get('/affiliate-admin/am-i-admin'),
  listAffiliates: (status) => api.get('/affiliate-admin/affiliates', { status }),
  getAffiliate: (id) => api.get(`/affiliate-admin/affiliates/${id}`),
  setAffiliateStatus: (id, status) => api.patch(`/affiliate-admin/affiliates/${id}/status`, { status }),
  listCommissions: (params) => api.get('/affiliate-admin/commissions', params),
  transitionCommission: (id, status, note) => api.patch(`/affiliate-admin/commissions/${id}/status`, { status, note }),
  getSettings: () => api.get('/affiliate-admin/settings'),
  updateSettings: (payload) => api.patch('/affiliate-admin/settings', payload),
  listAuditTrail: () => api.get('/affiliate-admin/audit-trail'),
};
