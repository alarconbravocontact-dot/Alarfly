import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportExportApi } from '../../api/reports';
import './QuickExportButtons.css';

// Botón de exportación rápida (PDF/Excel/CSV) para un reporte que YA
// se está viendo en pantalla, con los filtros actuales (`params`, ej.
// el rango de fechas elegido en DateRangeSelector) — reutiliza el
// mismo endpoint de descarga que ya existía en Reportes > Exportar,
// nunca vuelve a calcular nada. Con `canSchedule`, agrega el enlace de
// la innovación pedida: "Programar envío recurrente" lleva a
// Reportes > Exportar con el tipo y el rango YA elegidos en la URL,
// para no tener que reconfigurarlos ahí.
export default function QuickExportButtons({ reportType, params, canSchedule = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function handleExport(format) {
    setIsOpen(false);
    setIsExporting(true);
    setError('');
    try {
      await reportExportApi.download(reportType, format, params);
    } catch {
      setError('No se pudo exportar el reporte. Intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  }

  const scheduleQuery = new URLSearchParams({ reportType, schedule: '1', ...params }).toString();

  return (
    <div className="quick-export" ref={menuRef}>
      <button type="button" className="btn btn-small" onClick={() => setIsOpen((v) => !v)} disabled={isExporting}>
        {isExporting ? 'Exportando…' : 'Exportar ▾'}
      </button>
      {isOpen && (
        <div className="quick-export-menu">
          <button type="button" onClick={() => handleExport('pdf')}>
            PDF
          </button>
          <button type="button" onClick={() => handleExport('excel')}>
            Excel
          </button>
          <button type="button" onClick={() => handleExport('csv')}>
            CSV
          </button>
        </div>
      )}
      {canSchedule && <Link to={`/reportes/exportar?${scheduleQuery}`}>Programar envío recurrente</Link>}
      {error && <span className="text-muted">{error}</span>}
    </div>
  );
}
