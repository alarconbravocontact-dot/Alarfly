import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { membershipApi } from '../../api/membership';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusSeal from '../../core/ui/StatusSeal';
import HelpTooltip from '../../components/HelpTooltip';
import { formatCurrency, formatDate } from '../../utils/format';
import './MembershipPage.css';

// Planes → seleccionar → revisar → pagar → confirmar — en UNA sola
// pantalla con pasos internos (nunca varias rutas), tal como lo pide
// el pedido explícitamente. El precio/plan/moneda SIEMPRE vienen del
// servidor (GET /membership/plans, GET /membership/me) — este
// componente nunca los decide ni los envía de vuelta.
//
// No existe ningún proveedor de pago integrado todavía (decisión
// pendiente del usuario, documentada) — el pago es manual: comprobante
// + revisión humana de un Administrador de plataforma, mismo patrón
// que ya usa el proyecto para que los clientes de una empresa le paguen
// a ella (Zelle/Pago Móvil/transferencia). Por eso el estado final
// honesto tras enviar un comprobante es "en revisión", nunca "activa"
// — activarla de verdad es una decisión humana posterior.

const METHOD_LABELS = {
  ZELLE: 'Zelle',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFERENCIA: 'Transferencia bancaria',
  BINANCE: 'Binance',
  OTRO: 'Otro',
};

const STATUS_LABELS = {
  TRIALING: 'En período de prueba',
  PENDING_PAYMENT: 'Comprobante en revisión',
  ACTIVE: 'Activa',
  PAST_DUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

const STATUS_TONE = {
  TRIALING: 'neutral',
  PENDING_PAYMENT: 'warning',
  ACTIVE: 'positive',
  PAST_DUE: 'negative',
  CANCELLED: 'negative',
};

const ALLOWED_PROOF_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_PROOF_SIZE_BYTES = 3 * 1024 * 1024;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function PlanCard({ plan, highlighted }) {
  return (
    <div className={`membership-plan-card${highlighted ? ' is-highlighted' : ''}`}>
      <p className="membership-plan-name">{plan.name}</p>
      <p className="membership-plan-price">
        {formatCurrency(plan.priceAmount, plan.currency)}
        <span className="membership-plan-period"> / {plan.billingPeriodDays >= 28 ? 'mes' : `${plan.billingPeriodDays} días`}</span>
      </p>
      <p className="text-muted">{plan.trialDays} días de prueba gratis.</p>
      <ul className="membership-plan-features">
        {(plan.features || []).map((f, i) => (
          <li key={i}>✓ {f}</li>
        ))}
      </ul>
    </div>
  );
}

export default function MembershipPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === 'ADMIN';

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState(null);
  const [payments, setPayments] = useState([]);

  // 'status' = pantalla de resumen de siempre; 'checkout' = la
  // experiencia de pago de una sola pantalla.
  const [step, setStep] = useState('status');

  const [method, setMethod] = useState('ZELLE');
  const [referenceNote, setReferenceNote] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofError, setProofError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [viewData, paymentsData] = await Promise.all([membershipApi.getMine(), membershipApi.listMyPayments()]);
      setView(viewData);
      setPayments(paymentsData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar tu membresía.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startCheckout() {
    setSubmitError('');
    setProofError('');
    setProofFile(null);
    setIdempotencyKey(crypto.randomUUID());
    setStep('checkout');
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    setProofError('');
    if (!file) {
      setProofFile(null);
      return;
    }
    if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
      setProofError('Solo se aceptan comprobantes en PDF, PNG, JPG o WEBP.');
      setProofFile(null);
      return;
    }
    if (file.size > MAX_PROOF_SIZE_BYTES) {
      setProofError('El comprobante no puede pesar más de 3 MB.');
      setProofFile(null);
      return;
    }
    setProofFile(file);
  }

  async function handleConfirmPayment() {
    if (!proofFile) {
      setProofError('Adjunta el comprobante del pago.');
      return;
    }
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const contentBase64 = await readFileAsBase64(proofFile);
      await membershipApi.submitPayment({
        method,
        referenceNote: referenceNote || undefined,
        idempotencyKey,
        proofFileName: proofFile.name,
        proofMimeType: proofFile.type,
        proofSizeBytes: proofFile.size,
        proofContentBase64: contentBase64,
      });
      await load();
      setStep('status');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'No pudimos procesar tu pago. No se realizó ningún cambio en tu membresía.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <div className="panel">
          <p className="text-muted">Cargando tu membresía…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page">
        <div className="panel">
          <p className="alert-box alert-box-error">{loadError}</p>
        </div>
      </div>
    );
  }

  const plan = view.plan;
  const lastPayment = payments[0];
  const lastPaymentIsRejected = lastPayment?.status === 'REJECTED';

  // ===== Paso: checkout (revisar + datos de pago + confirmar, una sola pantalla) =====
  if (step === 'checkout') {
    return (
      <div className="page">
        <div className="panel">
          <div className="panel-header">
            <h2>Activar tu membresía</h2>
            <button type="button" className="btn btn-small" onClick={() => setStep('status')} disabled={isSubmitting}>
              Volver
            </button>
          </div>

          <div className="membership-checkout-grid">
            <div className="membership-summary-box">
              <p className="field-label">
                Información de la membresía
                <HelpTooltip text="Esto es lo que vas a contratar — el precio y la periodicidad siempre los define el servidor, nunca este formulario." />
              </p>
              <dl className="membership-summary-list">
                <div>
                  <dt>Plan</dt>
                  <dd>{plan.name}</dd>
                </div>
                <div>
                  <dt>Precio</dt>
                  <dd>{formatCurrency(plan.priceAmount, plan.currency)}</dd>
                </div>
                <div>
                  <dt>Periodicidad</dt>
                  <dd>Cada {plan.billingPeriodDays} días</dd>
                </div>
                <div className="membership-summary-total">
                  <dt>Total a pagar ahora</dt>
                  <dd>
                    <strong>{formatCurrency(plan.priceAmount, plan.currency)}</strong>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="membership-payment-box">
              <p className="field-label">Información de pago</p>
              <div className="form-grid">
                <label className="field">
                  <span>Método de pago</span>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={isSubmitting}>
                    {Object.entries(METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Referencia (opcional)</span>
                  <input
                    value={referenceNote}
                    onChange={(e) => setReferenceNote(e.target.value)}
                    placeholder="N.º de confirmación, últimos dígitos, etc."
                    disabled={isSubmitting}
                  />
                </label>
                <label className="field" style={{ gridColumn: 'span 2' }}>
                  <span className="field-label">
                    Comprobante de pago
                    <HelpTooltip text="Una captura de pantalla o PDF de la transferencia/pago realizado. Un Administrador de la plataforma lo revisa y confirma tu membresía — no se activa sola." />
                  </span>
                  <input
                    type="file"
                    accept={ALLOWED_PROOF_TYPES.join(',')}
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                </label>
              </div>
              {proofError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{proofError}</p>}
            </div>
          </div>

          <div className="membership-confirm-box">
            <p className="field-label">Estás contratando</p>
            <table className="data-table">
              <tbody>
                <tr>
                  <td>Plan</td>
                  <td className="num">{plan.name}</td>
                </tr>
                <tr>
                  <td>Precio</td>
                  <td className="num">{formatCurrency(plan.priceAmount, plan.currency)}</td>
                </tr>
                <tr>
                  <td>Periodicidad</td>
                  <td className="num">Cada {plan.billingPeriodDays} días</td>
                </tr>
                <tr>
                  <td>Método</td>
                  <td className="num">{METHOD_LABELS[method]}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td className="num">
                    <strong>{formatCurrency(plan.priceAmount, plan.currency)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {submitError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{submitError}</p>}

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-primary btn-large" onClick={handleConfirmPayment} disabled={isSubmitting}>
                {isSubmitting ? 'Estamos procesando tu pago…' : 'Pagar y activar membresía'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== Paso: resumen de estado (planes/estado/historial) =====
  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Tu membresía</h2>
          <StatusSeal tone={STATUS_TONE[view.status]} label={STATUS_LABELS[view.status]} />
        </div>

        <PlanCard plan={plan} highlighted />

        {view.status === 'TRIALING' && (
          <p className="alert-box alert-box-warning" style={{ marginTop: 16 }}>
            {view.daysLeftInTrial != null && view.daysLeftInTrial >= 0
              ? `Te quedan ${view.daysLeftInTrial} día(s) de prueba gratis.`
              : 'Tu período de prueba está por terminar.'}
          </p>
        )}

        {view.status === 'PAST_DUE' && (
          <p className="alert-box alert-box-error" style={{ marginTop: 16 }}>
            Tu período de prueba o el último pago ya vencieron. Activa tu membresía para seguir usando Alarfly sin
            interrupciones.
          </p>
        )}

        {view.status === 'PENDING_PAYMENT' && (
          <p className="alert-box alert-box-warning" style={{ marginTop: 16 }}>
            Tu pago está siendo procesado. Un Administrador de la plataforma revisará tu comprobante y confirmará tu
            membresía — no hace falta que hagas nada más.
          </p>
        )}

        {view.status === 'ACTIVE' && (
          <div className="membership-active-box" style={{ marginTop: 16 }}>
            <p>¡Tu membresía está activa!</p>
            {view.currentPeriodEnd && <p className="text-muted">Próxima renovación: {formatDate(new Date(view.currentPeriodEnd))}</p>}
          </div>
        )}

        {lastPaymentIsRejected && (
          <p className="alert-box alert-box-error" style={{ marginTop: 16 }}>
            No pudimos confirmar tu último comprobante{lastPayment.reviewNote ? `: ${lastPayment.reviewNote}` : '.'} No se
            realizó ningún cambio en tu membresía. Puedes intentar de nuevo.
          </p>
        )}

        <div className="btn-row" style={{ marginTop: 20 }}>
          {canManage && view.canSubmitPayment && (
            <button type="button" className="btn btn-primary btn-large" onClick={startCheckout}>
              {view.status === 'PAST_DUE' || lastPaymentIsRejected ? 'Intentar nuevamente' : 'Activar membresía ahora'}
            </button>
          )}
          {!canManage && view.canSubmitPayment && (
            <p className="text-muted">Pídele a un Administrador de tu empresa que active la membresía.</p>
          )}
          {view.status === 'ACTIVE' && (
            <button type="button" className="btn btn-primary btn-large" onClick={() => navigate('/')}>
              Entrar a Alarfly
            </button>
          )}
        </div>
      </div>

      {payments.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2>Historial de pagos</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Método</th>
                <th className="num">Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(new Date(p.createdAt))}</td>
                  <td>{METHOD_LABELS[p.method] || p.method}</td>
                  <td className="num">{formatCurrency(p.amount, p.currency)}</td>
                  <td>
                    <StatusSeal
                      tone={p.status === 'CONFIRMED' ? 'positive' : p.status === 'REJECTED' ? 'negative' : 'warning'}
                      label={p.status === 'CONFIRMED' ? 'Confirmado' : p.status === 'REJECTED' ? 'Rechazado' : 'En revisión'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
