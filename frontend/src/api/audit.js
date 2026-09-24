import { api } from './client';

// Fase 11 (sección 14/17): envoltura del par de rutas neutrales nuevas
// — la bitácora de auditoría general (antes escondida bajo
// /accounting/audit-log, ahora /audit-log) y el catálogo de trabajos
// automáticos (/jobs, nuevo). Ambas ADMIN-only en el backend.
export const auditApi = {
  list: (filters) => api.get('/audit-log', filters),
  forEntity: (entityType, entityId) => api.get(`/audit-log/${entityType}/${entityId}`),
};

export const jobsApi = {
  status: () => api.get('/jobs/status'),
  runs: (filters) => api.get('/jobs/runs', filters),
};
