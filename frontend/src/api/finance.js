import { api } from './client';

export const financeApi = {
  getSummary: () => api.get('/finance/summary'),
};
