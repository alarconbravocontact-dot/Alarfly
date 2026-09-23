import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsApi } from '../../api/accounting';
import { customersApi, arInvoicesApi } from '../../api/ar';
import { vendorsApi, apBillsApi } from '../../api/ap';
import { formatCurrency, formatDate } from '../../utils/format';
import './RecordLink.css';

// Hipervínculo consistente para cualquier número de factura, cliente,
// proveedor o cuenta contable dentro de un reporte (Feature S) — un
// solo componente compartido, no reimplementado reporte por reporte.
// "Llevar al registro de origen" navega a la pantalla que administra
// ese tipo de registro (este proyecto no tiene una ruta por registro
// individual en ningún módulo, ver CLAUDE.md).
const ROUTES = {
  account: '/contabilidad/cuentas',
  customer: '/cuentas/clientes',
  vendor: '/cuentas/proveedores',
  'ar-invoice': '/cuentas/facturas-venta',
  'ap-bill': '/cuentas/facturas-compra',
};

const ACCOUNT_TYPE_LABELS = { ASSET: 'Activo', LIABILITY: 'Pasivo', EQUITY: 'Patrimonio', INCOME: 'Ingreso', EXPENSE: 'Gasto' };
const AR_STATUS_LABELS = { OPEN: 'Abierta', PARTIALLY_PAID: 'Parcialmente pagada', PAID: 'Pagada', CANCELLED: 'Cancelada' };

async function fetchPreview(type, id) {
  if (type === 'account') {
    const a = await accountsApi.getOne(id);
    return {
      title: `${a.code} · ${a.name}`,
      lines: [`Tipo: ${ACCOUNT_TYPE_LABELS[a.type] || a.type}`, a.isActive ? 'Activa' : 'Inactiva', a.isPostable ? 'Recibe movimientos directos' : 'No recibe movimientos directos (tiene subcuentas)'],
    };
  }
  if (type === 'customer') {
    const c = await customersApi.getOne(id);
    return {
      title: c.name,
      lines: [
        c.isBlocked ? `Bloqueado${c.blockedReason ? `: ${c.blockedReason}` : ''}` : 'Sin bloqueo',
        c.creditLimit != null ? `Límite de crédito: ${formatCurrency(c.creditLimit)}` : 'Sin límite de crédito configurado',
      ],
    };
  }
  if (type === 'vendor') {
    const v = await vendorsApi.getOne(id);
    return { title: v.name, lines: [v.isActive ? 'Activo' : 'Inactivo'] };
  }
  if (type === 'ar-invoice') {
    const inv = await arInvoicesApi.getOne(id);
    return {
      title: `Factura N.º ${inv.invoiceNumber}`,
      lines: [
        inv.customer.name,
        AR_STATUS_LABELS[inv.status] || inv.status,
        `Total: ${formatCurrency(inv.totalAmount)} · Saldo: ${formatCurrency(Number(inv.totalAmount) - Number(inv.paidAmount))}`,
        `Vencimiento: ${formatDate(new Date(inv.dueDate))}`,
      ],
    };
  }
  if (type === 'ap-bill') {
    const bill = await apBillsApi.getOne(id);
    return {
      title: `Factura N.º ${bill.billNumber}`,
      lines: [
        bill.vendor.name,
        AR_STATUS_LABELS[bill.status] || bill.status,
        `Total: ${formatCurrency(bill.totalAmount)} · Saldo: ${formatCurrency(Number(bill.totalAmount) - Number(bill.paidAmount))}`,
        `Vencimiento: ${formatDate(new Date(bill.dueDate))}`,
      ],
    };
  }
  return null;
}

export default function RecordLink({ type, id, children }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const hoverTimer = useRef(null);

  if (!id) return <>{children}</>;

  function handleMouseEnter() {
    hoverTimer.current = setTimeout(async () => {
      setShowPopover(true);
      if (!preview) {
        setIsLoading(true);
        try {
          setPreview(await fetchPreview(type, id));
        } catch {
          setPreview({ title: 'No se pudo cargar la previsualización.', lines: [] });
        } finally {
          setIsLoading(false);
        }
      }
    }, 300);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimer.current);
    setShowPopover(false);
  }

  function handleClick() {
    const to = ROUTES[type];
    if (to) navigate(to);
  }

  return (
    <span className="record-link-wrap" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button type="button" className="record-link" onClick={handleClick}>
        {children}
      </button>
      {showPopover && (
        <span className="record-link-popover" role="tooltip">
          {isLoading && !preview ? (
            <span className="text-muted">Cargando…</span>
          ) : (
            preview && (
              <>
                <span className="record-link-popover-title">{preview.title}</span>
                {preview.lines.map((line, i) => (
                  <span key={i} className="record-link-popover-line">
                    {line}
                  </span>
                ))}
              </>
            )
          )}
        </span>
      )}
    </span>
  );
}
