import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { tablePreferencesApi } from '../../api/table-preferences';
import { useConfirm } from '../../context/ConfirmContext';
import EmptyState from './EmptyState';
import './DataTable.css';
import './Skeleton.css';

const MIN_COLUMN_WIDTH = 60;

function defaultColumnState(columns) {
  return columns.map((c, i) => ({
    key: c.key,
    visible: c.defaultVisible !== false,
    width: c.defaultWidth ?? null,
    order: i,
  }));
}

// Fusiona lo guardado en el servidor con las columnas que la pantalla
// define hoy — una columna nueva que se agregue más adelante al código
// (y que el usuario nunca configuró) aparece al final, visible por
// defecto, sin romper el orden ya guardado del resto.
function mergeWithSaved(columns, saved) {
  const savedByKey = Object.fromEntries(saved.map((s) => [s.columnKey, s]));
  let nextOrder = saved.length ? Math.max(...saved.map((s) => s.order)) + 1 : 0;
  const merged = columns.map((c) => {
    const s = savedByKey[c.key];
    if (s) return { key: c.key, visible: s.isVisible, width: s.width ?? c.defaultWidth ?? null, order: s.order };
    const order = nextOrder;
    nextOrder += 1;
    return { key: c.key, visible: c.defaultVisible !== false, width: c.defaultWidth ?? null, order };
  });
  return merged.sort((a, b) => a.order - b.order);
}

/**
 * Tabla reutilizable con columnas que el usuario puede reordenar
 * (arrastrando el encabezado), redimensionar (arrastrando el borde
 * derecho del encabezado) y ocultar/mostrar (panel "Columnas") — todo
 * se guarda por usuario y por `tableKey`, independiente de cualquier
 * otro usuario o tabla.
 *
 * `columns`: [{ key, label, value: (row) => texto/número para mostrar
 * y exportar, render?: (row) => JSX para mostrar algo más rico en
 * pantalla (si no está, se muestra el resultado de `value`),
 * align?: 'num', defaultVisible?, defaultWidth?, exportable?: false }]
 */
export default function DataTable({
  tableKey,
  columns,
  data,
  rowKey,
  emptyMessage = 'No hay datos para mostrar.',
  emptyIcon = '▤',
  expandedRowRender,
  exportTitle,
  isLoading = false,
  skeletonRowCount = 6,
}) {
  const confirm = useConfirm();
  const [columnState, setColumnState] = useState(() => defaultColumnState(columns));
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const dragKeyRef = useRef(null);
  const resizeRef = useRef(null);
  const configRef = useRef(null);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    tablePreferencesApi
      .get(tableKey)
      .then((saved) => {
        if (!cancelled) setColumnState(mergeWithSaved(columns, saved));
      })
      .catch(() => {
        if (!cancelled) setColumnState(defaultColumnState(columns));
      });
    return () => {
      cancelled = true;
    };
    // Las columnas de una tabla se definen una vez por pantalla, no
    // cambian en caliente — solo se vuelve a cargar si cambia la tabla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  useEffect(() => {
    if (!isConfigOpen) return undefined;
    function handleClickOutside(event) {
      if (configRef.current && !configRef.current.contains(event.target)) setIsConfigOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isConfigOpen]);

  useEffect(() => {
    if (!isExportMenuOpen) return undefined;
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) setIsExportMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  const columnsByKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);

  const visibleOrdered = useMemo(
    () => [...columnState].filter((c) => c.visible).sort((a, b) => a.order - b.order),
    [columnState]
  );

  async function persist(nextState) {
    setColumnState(nextState);
    try {
      await tablePreferencesApi.save(
        tableKey,
        nextState.map(({ key, visible, width, order }) => ({ columnKey: key, isVisible: visible, width, order }))
      );
    } catch {
      // Es una preferencia de presentación, no un dato de negocio: si
      // falla el guardado, la pantalla sigue funcionando con el cambio
      // aplicado localmente, solo no persiste para la próxima visita.
    }
  }

  function toggleVisible(key) {
    persist(columnState.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }

  function handleDrop(targetKey) {
    const draggedKey = dragKeyRef.current;
    dragKeyRef.current = null;
    if (!draggedKey || draggedKey === targetKey) return;
    const ordered = [...visibleOrdered];
    const fromIndex = ordered.findIndex((c) => c.key === draggedKey);
    const toIndex = ordered.findIndex((c) => c.key === targetKey);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    const reorderedByKey = Object.fromEntries(ordered.map((c, i) => [c.key, { ...c, order: i }]));
    persist(columnState.map((c) => reorderedByKey[c.key] || c));
  }

  function handleResizeStart(event, key) {
    event.preventDefault();
    const th = event.currentTarget.closest('th');
    resizeRef.current = { key, startX: event.clientX, startWidth: th.offsetWidth };

    function onMouseMove(e) {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(resizeRef.current.startWidth + delta));
      setColumnState((prev) => prev.map((c) => (c.key === resizeRef.current.key ? { ...c, width: newWidth } : c)));
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      resizeRef.current = null;
      setColumnState((prev) => {
        persist(prev);
        return prev;
      });
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  async function handleReset() {
    const ok = await confirm({
      title: 'Restablecer vista por defecto',
      message: 'Vas a borrar el orden, ancho y columnas ocultas que configuraste en esta tabla. Volverá a verse como al principio.',
      confirmLabel: 'Restablecer',
      tone: 'danger',
    });
    if (!ok) return;
    setColumnState(defaultColumnState(columns));
    try {
      await tablePreferencesApi.reset(tableKey);
    } catch {
      // no crítico
    }
  }

  async function handleExport(format) {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    setExportError('');
    try {
      const exportColumns = visibleOrdered
        .map((c) => columnsByKey[c.key])
        .filter((c) => c && c.exportable !== false && c.value);
      const rows = data.map((row) => {
        const flat = {};
        for (const col of exportColumns) flat[col.key] = col.value(row);
        return flat;
      });
      await tablePreferencesApi.exportTable(
        exportTitle || tableKey,
        exportColumns.map((c) => ({ key: c.key, label: c.label })),
        rows,
        format
      );
    } catch {
      setExportError('No se pudo exportar la tabla. Intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="ui-datatable-wrap">
      <div className="ui-datatable-toolbar">
        <div className="ui-datatable-config" ref={configRef}>
          <button type="button" className="btn btn-small" onClick={() => setIsConfigOpen((v) => !v)}>
            ⚙ Columnas
          </button>
          {isConfigOpen && (
            <div className="ui-datatable-config-popover">
              {columns.map((col) => {
                const state = columnState.find((c) => c.key === col.key);
                return (
                  <label key={col.key} className="ui-datatable-config-row">
                    <input type="checkbox" checked={state?.visible ?? true} onChange={() => toggleVisible(col.key)} />
                    {col.label || col.key}
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-small" onClick={handleReset}>
            Restablecer vista por defecto
          </button>
          <div className="ui-datatable-export" ref={exportMenuRef}>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setIsExportMenuOpen((v) => !v)}
              disabled={isExporting || data.length === 0}
            >
              {isExporting ? 'Exportando…' : 'Exportar ▾'}
            </button>
            {isExportMenuOpen && (
              <div className="ui-datatable-export-menu">
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
          </div>
        </div>
      </div>
      {exportError && (
        <p className="alert-box alert-box-error" style={{ marginBottom: 0 }}>
          {exportError}
        </p>
      )}

      {isLoading ? (
        <div className="ui-datatable-scroll">
          <table className="data-table ui-datatable">
            <thead>
              <tr>
                {visibleOrdered.map((colState) => {
                  const col = columnsByKey[colState.key];
                  return (
                    <th key={col.key} className={col.align === 'num' ? 'num' : undefined} style={colState.width ? { width: colState.width } : undefined}>
                      <span className="ui-datatable-th-label">{col.label}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody aria-busy="true" aria-label="Cargando datos">
              {Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {visibleOrdered.map((colState) => {
                    const col = columnsByKey[colState.key];
                    const widthPct = col.align === 'num' ? 55 : 55 + ((rowIndex * 13 + colState.order * 7) % 35);
                    return (
                      <td key={col.key} className={col.align === 'num' ? 'num' : undefined}>
                        <span className="ui-skeleton" style={{ width: `${widthPct}%` }} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={emptyIcon} message={emptyMessage} />
      ) : (
        <div className="ui-datatable-scroll">
          <table className="data-table ui-datatable">
            <thead>
              <tr>
                {visibleOrdered.map((colState) => {
                  const col = columnsByKey[colState.key];
                  return (
                    <th
                      key={col.key}
                      className={col.align === 'num' ? 'num' : undefined}
                      style={colState.width ? { width: colState.width } : undefined}
                      draggable
                      onDragStart={() => {
                        dragKeyRef.current = col.key;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(col.key)}
                      title="Arrastra para reordenar"
                    >
                      <span className="ui-datatable-th-label">{col.label}</span>
                      <span
                        className="ui-datatable-resize-handle"
                        draggable={false}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(e, col.key);
                        }}
                        title="Arrastra para cambiar el ancho"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const key = rowKey(row);
                const expanded = expandedRowRender ? expandedRowRender(row) : null;
                return (
                  <Fragment key={key}>
                    <tr>
                      {visibleOrdered.map((colState) => {
                        const col = columnsByKey[colState.key];
                        return (
                          <td key={col.key} className={col.align === 'num' ? 'num' : undefined}>
                            {col.render ? col.render(row) : col.value ? col.value(row) : null}
                          </td>
                        );
                      })}
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={visibleOrdered.length}>{expanded}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
