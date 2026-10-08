import { Fragment, useCallback, useEffect, useState } from 'react';
import { membershipAdminApi } from '../../api/membership-admin';
import { ApiError } from '../../api/client';
import { useConfirm } from '../../context/ConfirmContext';
import EmptyState from '../../core/ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/format';

// Administración CRUZADA de pagos de membresía (cruza empresas) — vive
// dentro del área administrativa normal del frontend, mismo patrón ya
// usado por `/admin/afiliados`: el backend es quien de verdad protege
// esto (requireMembershipAdmin); esta pantalla ni siquiera se monta en
// la navegación si `amIAdmin()` da false (ver AppLayout.jsx).
const METHOD_LABELS = {
  ZELLE: 'Zelle',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFERENCIA: 'Transferencia bancaria',
  BINANCE: 'Binance',
  OTRO: 'Otro',
};

export default function MembershipAdminPage() {
  const confirm = useConfirm();
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [proofByPaymentId, setProofByPaymentId] = useState({});
  const [noteByPaymentId, setNoteByPaymentId] = useState({});
  const [actionError, setActionError] = useState({});
  const [decidingId, setDecidingId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await membershipAdminApi.listPendingPayments();
      setPayments(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la administración de membresías.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleExpand(payment) {
    if (expandedId === payment.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(payment.id);
    if (!proofByPaymentId[payment.id]) {
      try {
        const proof = await membershipAdminApi.getPaymentProof(payment.id);
        setProofByPaymentId((prev) => ({ ...prev, [payment.id]: proof }));
      } catch {
        // si falla, el panel simplemente no muestra el comprobante
      }
    }
  }

  async function handleDecide(payment, approve) {
    const ok = await confirm({
      title: approve ? 'Confirmar pago' : 'Rechazar comprobante',
      message: approve
        ? `Vas a activar la membresía de "${payment.membership.company.name}" por ${formatCurrency(payment.amount, payment.currency)}.`
        : `Vas a rechazar el comprobante de "${payment.membership.company.name}". No se activará ningún cambio en su membresía.`,
      confirmLabel: approve ? 'Confirmar pago' : 'Rechazar',
      tone: approve ? undefined : 'danger',
    });
    if (!ok) return;

    setActionError((prev) => ({ ...prev, [payment.id]: '' }));
    setDecidingId(payment.id);
    try {
      await membershipAdminApi.decidePayment(payment.id, approve, noteByPaymentId[payment.id] || undefined);
      await load();
    } catch (err) {
      setActionError((prev) => ({
        ...prev,
        [payment.id]: err instanceof ApiError ? err.message : 'No se pudo completar la acción.',
      }));
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Administración de Membresías</h2>
        </div>

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && payments.length === 0 && (
          <EmptyState icon="◎" message="No hay comprobantes de pago pendientes de revisión." />
        )}

        {!isLoading && !loadError && payments.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plan</th>
                <th className="num">Monto</th>
                <th>Método</th>
                <th>Enviado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const proof = proofByPaymentId[payment.id];
                return (
                  <Fragment key={payment.id}>
                    <tr>
                      <td>{payment.membership.company.name}</td>
                      <td>{payment.membership.plan.name}</td>
                      <td className="num">{formatCurrency(payment.amount, payment.currency)}</td>
                      <td>{METHOD_LABELS[payment.method] || payment.method}</td>
                      <td>{formatDate(new Date(payment.createdAt))}</td>
                      <td>
                        <button type="button" className="btn btn-small" onClick={() => toggleExpand(payment)}>
                          {expandedId === payment.id ? 'Ocultar' : 'Revisar'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === payment.id && (
                      <tr>
                        <td colSpan={6}>
                          <div className="form-grid" style={{ marginBottom: 12 }}>
                            <div className="field">
                              <span>Enviado por</span>
                              <p>
                                {payment.requestedByUser.name} ({payment.requestedByUser.email})
                              </p>
                            </div>
                            {payment.referenceNote && (
                              <div className="field">
                                <span>Referencia</span>
                                <p>{payment.referenceNote}</p>
                              </div>
                            )}
                          </div>

                          {proof?.proofContentBase64 && (
                            <div style={{ marginBottom: 12 }}>
                              {proof.proofMimeType?.startsWith('image/') ? (
                                <img
                                  src={`data:${proof.proofMimeType};base64,${proof.proofContentBase64}`}
                                  alt="Comprobante de pago"
                                  style={{ maxWidth: 360, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                                />
                              ) : (
                                <a
                                  href={`data:${proof.proofMimeType};base64,${proof.proofContentBase64}`}
                                  download={proof.proofFileName}
                                  className="btn btn-small"
                                >
                                  Descargar comprobante ({proof.proofFileName})
                                </a>
                              )}
                            </div>
                          )}

                          <label className="field" style={{ marginBottom: 12 }}>
                            <span>Nota (opcional)</span>
                            <input
                              value={noteByPaymentId[payment.id] || ''}
                              onChange={(e) => setNoteByPaymentId((prev) => ({ ...prev, [payment.id]: e.target.value }))}
                              placeholder="Motivo del rechazo, o una nota para el historial"
                            />
                          </label>

                          {actionError[payment.id] && (
                            <p className="alert-box alert-box-error" style={{ marginBottom: 12 }}>
                              {actionError[payment.id]}
                            </p>
                          )}

                          <div className="btn-row">
                            <button
                              type="button"
                              className="btn btn-primary btn-small"
                              disabled={decidingId === payment.id}
                              onClick={() => handleDecide(payment, true)}
                            >
                              Confirmar pago
                            </button>
                            <button
                              type="button"
                              className="btn btn-small btn-danger"
                              disabled={decidingId === payment.id}
                              onClick={() => handleDecide(payment, false)}
                            >
                              Rechazar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
