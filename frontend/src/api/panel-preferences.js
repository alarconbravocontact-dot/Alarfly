import { api } from './client';

export const panelPreferencesApi = {
  get: (panelKey) => api.get(`/panel-preferences/${panelKey}`),
  set: (panelKey, isCollapsed) => api.patch(`/panel-preferences/${panelKey}`, { isCollapsed }),
};
