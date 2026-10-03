import { affiliateApi } from './affiliateAuth';

// Endpoints del propio afiliado (sesión de afiliado, no de empresa).
export const affiliateSelfApi = {
  register: (name, email, password, phone) => affiliateApi.post('/affiliates/register', { name, email, password, phone }),
  login: (email, password) => affiliateApi.post('/affiliates/login', { email, password }),
  getProfile: () => affiliateApi.get('/affiliates/me'),
  getLink: () => affiliateApi.get('/affiliates/me/link'),
  getSummary: () => affiliateApi.get('/affiliates/me/summary'),
  listReferrals: () => affiliateApi.get('/affiliates/me/referrals'),
  listCommissions: (status) => affiliateApi.get('/affiliates/me/commissions', { status }),
};
