import { api } from './client';

export const accessLevelsApi = {
  myPermissions: () => api.get('/access-levels/my-permissions'),
  listUsers: () => api.get('/access-levels/users'),
  quotas: () => api.get('/access-levels/quotas'),
  roles: () => api.get('/access-levels/roles'),
  inviteUser: (data) => api.post('/access-levels/users/invite', data),
  changeRole: (userId, role) => api.patch(`/access-levels/users/${userId}/role`, { role }),
  activateUser: (userId) => api.post(`/access-levels/users/${userId}/activate`),
  deactivateUser: (userId) => api.post(`/access-levels/users/${userId}/deactivate`),
  listDelegatedPermissions: () => api.get('/access-levels/delegated-permissions'),
  grantDelegatedPermission: (userId, permissionKey) =>
    api.post(`/access-levels/delegated-permissions/${userId}/grant`, { permissionKey }),
  revokeDelegatedPermission: (userId, permissionKey) =>
    api.post(`/access-levels/delegated-permissions/${userId}/revoke`, { permissionKey }),
};
