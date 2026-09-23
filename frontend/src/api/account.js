import { api, getToken, ApiError } from './client';
import { withProgress } from '../utils/progressBarBus';

async function downloadMyActivity(format, params = {}) {
  return withProgress(async () => {
    const query = new URLSearchParams({ format });
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, value);
    }
    const response = await fetch(`/api/account/activity/export?${query}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(data?.error?.message || 'No se pudo exportar tu actividad.', response.status, data?.error?.code);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mi-actividad.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

export const accountApi = {
  getProfile: () => api.get('/account/profile'),
  updateProfile: (data) => api.patch('/account/profile', data),
  uploadAvatar: (data) => api.post('/account/profile/avatar', data),
  updateApprovalSignature: (signature) => api.patch('/account/profile/approval-signature', { signature }),

  getCompanyProfile: () => api.get('/account/company-profile'),
  updateCompanyProfile: (data) => api.patch('/account/company-profile', data),

  getSetupStatus: () => api.get('/account/setup-status'),

  listMyCompanies: () => api.get('/account/companies'),
  switchActiveCompany: (companyId) => api.post('/account/companies/switch', { companyId }),

  changePassword: (data) => api.post('/account/security/change-password', data),
  setupTwoFactor: () => api.post('/account/security/2fa/setup'),
  verifyTwoFactorSetup: (code) => api.post('/account/security/2fa/verify', { code }),
  disableTwoFactor: (password, code) => api.post('/account/security/2fa/disable', { password, code }),
  listSessions: () => api.get('/account/security/sessions'),
  revokeSession: (id) => api.post(`/account/security/sessions/${id}/revoke`),

  getMyRole: () => api.get('/account/role'),

  getPreferences: () => api.get('/account/preferences'),
  updatePreferences: (data) => api.patch('/account/preferences', data),

  listNotificationPreferences: () => api.get('/account/notification-preferences'),
  updateNotificationPreference: (alertType, data) =>
    api.patch(`/account/notification-preferences/${alertType}`, data),

  listMyActivity: (params) => api.get('/account/activity', params),
  exportMyActivity: downloadMyActivity,

  requestDeletion: (reason) => api.post('/account/deletion-requests', { reason }),
  // Solo Administrador: revisar y decidir las solicitudes de baja de
  // otros usuarios (se usa desde Niveles de Acceso, no desde Mi Cuenta).
  listDeletionRequests: (params) => api.get('/account/deletion-requests', params),
  decideDeletion: (id, approve, note) => api.post(`/account/deletion-requests/${id}/decide`, { approve, note }),
};
