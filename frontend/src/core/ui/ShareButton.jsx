import { useToast } from '../../context/ToastContext';
import Icon from './Icon';
import './ShareButton.css';

// Prompt 2 (UX): botón de compartir reutilizable — usa la Web Share
// API nativa cuando el navegador la soporta (el propio sistema
// operativo muestra sus apps reales de compartir; nunca se integró
// ningún SDK de red social, tal como pide explícitamente el prompt).
// Cuando no está disponible (la mayoría de navegadores de escritorio),
// copia la URL actual al portapapeles y confirma con el mismo sistema
// de toasts ya existente — no se inventó un mecanismo de confirmación
// aparte.
export default function ShareButton({ title, text, url, className = '' }) {
  const { showToast } = useToast();

  async function handleShare() {
    const shareUrl = url || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch (err) {
        // AbortError: el usuario cerró el panel de compartir sin elegir
        // nada — no es un error real, no hace falta avisar nada.
        if (err?.name !== 'AbortError') {
          showToast({ message: 'No se pudo compartir. Intenta de nuevo.' });
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast({ message: 'Enlace copiado al portapapeles.' });
    } catch {
      showToast({ message: 'No se pudo copiar el enlace. Cópialo manualmente desde la barra de direcciones.' });
    }
  }

  return (
    <button type="button" className={`share-button${className ? ` ${className}` : ''}`} onClick={handleShare} aria-label="Compartir esta página" title="Compartir">
      <Icon name="share" label="Compartir" />
    </button>
  );
}
