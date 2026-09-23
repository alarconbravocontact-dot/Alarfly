import { api } from './client';

export const viewPreferencesApi = {
  get: (viewKey) => api.get(`/view-preferences/${viewKey}`),
  set: (viewKey, mode) => api.patch(`/view-preferences/${viewKey}`, { mode }),
};
