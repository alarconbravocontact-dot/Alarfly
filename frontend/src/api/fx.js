import { api } from './client';

export const fxApi = {
  getLatestRates: () => api.get('/fx/latest-rates'),
};
