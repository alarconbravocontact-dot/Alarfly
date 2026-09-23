import { api } from './client';

export const helpApi = {
  getContext: (moduleKey) => api.get('/help/context', { moduleKey }),
  ask: (moduleKey, questionText) => api.post('/help/ask', { moduleKey, questionText }),
};
