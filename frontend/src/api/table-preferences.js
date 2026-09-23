import { api, getToken, ApiError } from './client';
import { withProgress } from '../utils/progressBarBus';

const EXTENSIONS = { pdf: 'pdf', excel: 'xlsx', csv: 'csv' };

// Exportar la tabla es un archivo binario, no JSON — mismo criterio que
// accountApi.exportMyActivity: no puede pasar por el cliente HTTP
// genérico, así que arma su propia petición y dispara la descarga.
// Respeta las columnas visibles y el orden actuales, y lo que sea que
// ya esté filtrado en pantalla (esta tabla puede tener un
// FilterBuilder encima) — nunca vuelve a consultar el dataset completo.
async function downloadTable(title, columns, rows, format = 'excel') {
  return withProgress(async () => {
    const response = await fetch('/api/table-preferences/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ title, columns, rows, format }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(data?.error?.message || 'No se pudo exportar la tabla.', response.status, data?.error?.code);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.${EXTENSIONS[format] || 'xlsx'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

export const tablePreferencesApi = {
  get: (tableKey) => api.get(`/table-preferences/${tableKey}`),
  save: (tableKey, columns) => api.patch(`/table-preferences/${tableKey}`, { columns }),
  reset: (tableKey) => api.delete(`/table-preferences/${tableKey}`),
  exportTable: downloadTable,
};
