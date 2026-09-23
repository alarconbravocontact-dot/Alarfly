import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import HelpTooltip from '../../components/HelpTooltip';

export default function DangerZoneSection() {
  const { logout } = useAuth();
  const confirm = useConfirm();
  const [reason, setReason] = useState('');
  const [requested, setRequested] = useState(false);

  const requestMutation = useMutation({
    mutationFn: () => accountApi.requestDeletion(reason || undefined),
    onSuccess: () => setRequested(true),
  });

  async function handleRequest() {
    const ok = await confirm({
      title: 'Solicitar baja de cuenta',
      message:
        'Esto no borra nada de inmediato: le llega una solicitud al Administrador de tu empresa, y solo cuando él la aprueba tu cuenta queda desactivada.',
      confirmLabel: 'Solicitar baja',
      tone: 'danger',
    });
    if (!ok) return;
    requestMutation.mutate();
  }

  return (
    <div className="panel" style={{ borderColor: 'var(--color-negative)' }}>
      <div className="panel-header">
        <h2 className="field-label">
          Zona de riesgo
          <HelpTooltip text="Solicitar la baja de tu cuenta no la elimina al instante: un Administrador debe aprobarla primero. Mientras tanto, puedes seguir usando el sistema con normalidad." />
        </h2>
      </div>

      {requested || requestMutation.isSuccess ? (
        <p className="alert-box alert-box-success">
          Tu solicitud fue enviada. Un Administrador la va a revisar — mientras tanto tu cuenta sigue activa.
        </p>
      ) : (
        <>
          <p className="text-muted">
            Si ya no vas a usar Alarfly, puedes solicitar la baja de tu cuenta. Un Administrador debe aprobarla
            antes de que se desactive — no se borra nada automáticamente.
          </p>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Motivo (opcional)</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </label>
          </div>
          {requestMutation.isError && (
            <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
              {requestMutation.error instanceof ApiError ? requestMutation.error.message : 'No se pudo enviar la solicitud.'}
            </p>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-danger btn-small"
              disabled={requestMutation.isPending}
              onClick={handleRequest}
            >
              {requestMutation.isPending ? 'Enviando…' : 'Solicitar baja de cuenta'}
            </button>
          </div>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
        <button type="button" className="btn btn-small" onClick={logout}>
          Cerrar sesión en este dispositivo
        </button>
      </div>
    </div>
  );
}
