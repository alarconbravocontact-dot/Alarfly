import { useEffect, useRef, useState } from 'react';
import { buildMailtoUrl } from '../../utils/emailTemplates';
import './DocumentActionsMenu.css';

// Menú unificado de acciones de salida (Feature W) — un solo
// componente compartido para Imprimir/Enviar por correo/Compartir por
// enlace/Exportar, usado de forma consistente en todo el sistema en
// vez de reimplementarlo reporte por reporte o documento por
// documento. Cada acción es opcional (se omite del menú si la
// pantalla que lo usa no la aplica):
// - onPrint: función, default `window.print()`.
// - shareUrl: string; si se da, copia el enlace al portapapeles
//   (mismo patrón ya usado en "Vistas guardadas" de FilterBuilder).
// - exportOptions: [{format, label}], junto con `onExport(format)`.
// - emailTemplates + emailContext (+ emailRecipient opcional): arma
//   un enlace `mailto:` con el asunto/cuerpo ya prellenados según la
//   plantilla elegida — nunca envía el correo directo (el proyecto no
//   tiene servidor de correo saliente, ver CLAUDE.md); abre el
//   cliente de correo real del usuario con el borrador listo.
export default function DocumentActionsMenu({
  onPrint,
  shareUrl,
  exportOptions,
  onExport,
  emailTemplates,
  emailContext,
  emailRecipient,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [subMenu, setSubMenu] = useState(null); // 'export' | 'email' | null
  const [copyLabel, setCopyLabel] = useState('Compartir por enlace');
  const [opensUpward, setOpensUpward] = useState(false);
  const menuRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
        setSubMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Si el menú abriría fuera de la parte visible de la pantalla (ej.
  // disparado desde el pie de un panel deslizable cerca del borde
  // inferior), se abre hacia arriba en vez de recortarse fuera del
  // viewport. Se mide desde el botón que dispara el menú (posición
  // estable, nunca cambia con la clase "opens-upward") en vez del
  // propio dropdown — medirse a sí mismo después de ya haberse volteado
  // hacia arriba da un resultado que oscila entre abrir arriba/abajo
  // en cada cambio de submenú, porque el punto de referencia cambia
  // junto con el resultado que se está calculando.
  useEffect(() => {
    if (!isOpen || !menuRef.current || !dropdownRef.current) return;
    const buttonRect = menuRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current.offsetHeight;
    setOpensUpward(buttonRect.bottom + dropdownHeight > window.innerHeight);
  }, [isOpen, subMenu]);

  function handlePrint() {
    setIsOpen(false);
    (onPrint || (() => window.print()))();
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyLabel('¡Enlace copiado!');
      setTimeout(() => setCopyLabel('Compartir por enlace'), 2500);
    } catch {
      window.prompt('Copia este enlace para compartir:', shareUrl);
    }
    setIsOpen(false);
  }

  function handleEmailTemplate(template) {
    const subject = template.buildSubject(emailContext || {});
    const body = template.buildBody(emailContext || {});
    window.location.href = buildMailtoUrl({ to: emailRecipient, subject, body });
    setIsOpen(false);
    setSubMenu(null);
  }

  function handleExportFormat(format) {
    onExport(format);
    setIsOpen(false);
    setSubMenu(null);
  }

  return (
    <div className="document-actions-menu" ref={menuRef}>
      <button type="button" className="btn btn-small" onClick={() => setIsOpen((v) => !v)}>
        Acciones ▾
      </button>
      {isOpen && (
        <div className={`document-actions-dropdown${opensUpward ? ' opens-upward' : ''}`} ref={dropdownRef}>
          {subMenu === null && (
            <>
              <button type="button" onClick={handlePrint}>
                🖶 Imprimir
              </button>
              {emailTemplates && emailTemplates.length > 0 && (
                <button type="button" onClick={() => setSubMenu('email')}>
                  ✉ Enviar por correo ▸
                </button>
              )}
              {shareUrl && (
                <button type="button" onClick={handleShare}>
                  🔗 {copyLabel}
                </button>
              )}
              {exportOptions && exportOptions.length > 0 && (
                <button type="button" onClick={() => setSubMenu('export')}>
                  ⬇ Exportar ▸
                </button>
              )}
            </>
          )}
          {subMenu === 'email' && (
            <>
              <button type="button" className="document-actions-back" onClick={() => setSubMenu(null)}>
                ‹ Volver
              </button>
              {emailTemplates.map((template) => (
                <button type="button" key={template.key} onClick={() => handleEmailTemplate(template)}>
                  {template.label}
                </button>
              ))}
            </>
          )}
          {subMenu === 'export' && (
            <>
              <button type="button" className="document-actions-back" onClick={() => setSubMenu(null)}>
                ‹ Volver
              </button>
              {exportOptions.map((opt) => (
                <button type="button" key={opt.format} onClick={() => handleExportFormat(opt.format)}>
                  {opt.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
