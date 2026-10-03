// Cliente HTTP propio para la sesión de AFILIADO — deliberadamente
// separado de src/api/client.js (que siempre adjunta el token de
// sesión de EMPRESA, `alarfly_token`). Un afiliado no es un User de
// ninguna empresa (ver backend core/affiliates), así que necesita su
// propio token guardado bajo su propia llave — los dos pueden convivir
// en el mismo navegador sin pisarse (ej. un Administrador de
// plataforma con sesión de empresa Y sesión de afiliado abiertas a la
// vez, en pestañas distintas de la misma app).
const AFFILIATE_TOKEN_KEY = 'alarfly_affiliate_token';
const AFFILIATE_KEY = 'alarfly_affiliate';

export function getAffiliateToken() {
  return localStorage.getItem(AFFILIATE_TOKEN_KEY);
}

export function getStoredAffiliate() {
  const raw = localStorage.getItem(AFFILIATE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setAffiliateSession(token, affiliate) {
  localStorage.setItem(AFFILIATE_TOKEN_KEY, token);
  localStorage.setItem(AFFILIATE_KEY, JSON.stringify(affiliate));
}

export function clearAffiliateSession() {
  localStorage.removeItem(AFFILIATE_TOKEN_KEY);
  localStorage.removeItem(AFFILIATE_KEY);
}

export class AffiliateApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }

  const token = getAffiliateToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url.pathname + url.search, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || 'Ocurrió un error inesperado. Intenta de nuevo.';
    throw new AffiliateApiError(message, response.status, data?.error?.code);
  }

  return data;
}

export const affiliateApi = {
  get: (path, query) => request(path, { method: 'GET', query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
};
