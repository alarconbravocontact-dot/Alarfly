import StatusSeal from './StatusSeal';
import { computeDueDateStatus, formatDueDateLabel } from '../../utils/dueDateStatus';

const TONE_BY_LEVEL = { OK: 'positive', WARNING: 'warning', CRITICAL: 'negative' };

/**
 * Etiqueta de Estado de Vencimiento: mismo componente en todos los
 * módulos con documentos con fecha de vencimiento (Facturas de Venta,
 * Facturas de Compra, Cuotas de Deuda, Obligaciones Fiscales). Tres
 * niveles semafóricos — verde (al día), amarillo (próximo a vencer,
 * dentro de `thresholdDays`, configurable por el Administrador desde
 * Mi Cuenta > Perfil de la Empresa) y rojo (vencido). Construido sobre
 * `StatusSeal`, que ya combina ícono + texto — nunca depende solo del
 * color, para que sea legible también para usuarios con daltonismo.
 */
export default function DueDateStatus({ dueDate, thresholdDays, referenceDate }) {
  const level = computeDueDateStatus(dueDate, thresholdDays, referenceDate);
  const label = formatDueDateLabel(dueDate, referenceDate);
  return <StatusSeal tone={TONE_BY_LEVEL[level]} label={label} />;
}
