import { api } from './client';

export const recentlyUsedApi = {
  list: (entityType) => api.get(`/recently-used/${entityType}`),
  record: (entityType, entityId) => api.post(`/recently-used/${entityType}`, { entityId }),
};
