import { usePinnedItems } from '../../context/PinnedItemsContext';
import './PinButton.css';

// Botón genérico de anclar/desanclar, reutilizable sobre cualquier
// ruta real de navegación (un reporte, una vista filtrada) — no sabe
// nada de reportes ni de facturas, solo recibe `path`/`label`.
export default function PinButton({ path, label }) {
  const { isPinned, items, pin, unpin } = usePinnedItems();
  const pinned = isPinned(path);

  async function handleClick() {
    if (pinned) {
      const item = items.find((i) => i.path === path);
      if (item) await unpin(item.id);
    } else {
      await pin(path, label);
    }
  }

  return (
    <button
      type="button"
      className={`ui-pin-button${pinned ? ' is-pinned' : ''}`}
      onClick={handleClick}
      title={pinned ? 'Desanclar del menú lateral' : 'Anclar al menú lateral'}
      aria-pressed={pinned}
    >
      <span aria-hidden="true">◈</span> {pinned ? 'Anclado' : 'Anclar'}
    </button>
  );
}
