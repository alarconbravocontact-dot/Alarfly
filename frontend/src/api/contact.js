import { api } from './client';

// Reutiliza el mismo cliente HTTP genérico que ya usa el resto de la
// app (`api/client.js`, el mismo que usan `/acceso`/`/registro` antes
// de tener sesión) — no se construyó un cliente aparte para esto.
export const contactApi = {
  send: (payload) => api.post('/contact', payload),
};
