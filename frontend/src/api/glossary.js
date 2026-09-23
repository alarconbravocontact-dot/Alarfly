import { api } from './client';

// La lista de términos no cambia mientras dura la sesión (vive en
// código en el backend) — se pide una sola vez y se comparte entre
// todos los <GlossaryTerm> de la pantalla, en vez de que cada uno
// dispare su propia llamada.
let cachedTermsPromise = null;

export const glossaryApi = {
  listTerms: () => {
    if (!cachedTermsPromise) {
      cachedTermsPromise = api.get('/glossary').catch((err) => {
        cachedTermsPromise = null; // permitir reintentar si falló
        throw err;
      });
    }
    return cachedTermsPromise;
  },
  getLiveValue: (key) => api.get(`/glossary/${key}/value`),
};
