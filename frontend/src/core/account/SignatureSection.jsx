import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import HelpTooltip from '../../components/HelpTooltip';

export default function SignatureSection() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ['account', 'profile'], queryFn: accountApi.getProfile });
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (profileQuery.data) setSignature(profileQuery.data.approvalSignature || '');
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => accountApi.updateApprovalSignature(signature),
    onSuccess: (updated) => queryClient.setQueryData(['account', 'profile'], updated),
  });

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Firma de aprobación
          <HelpTooltip text="El texto que queda registrado cuando apruebas un pago o un asiento contable — por ejemplo tus iniciales o tu nombre completo." />
        </h2>
      </div>
      <div className="form-grid">
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Texto de tu firma</span>
          <input value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={200} placeholder="Ej: J.P." />
        </label>
      </div>
      {updateMutation.isError && (
        <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
          {updateMutation.error instanceof ApiError ? updateMutation.error.message : 'No se pudo guardar.'}
        </p>
      )}
      {updateMutation.isSuccess && (
        <p className="alert-box alert-box-success" style={{ marginTop: 12 }}>
          Firma guardada.
        </p>
      )}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate()}
        >
          {updateMutation.isPending ? 'Guardando…' : 'Guardar firma'}
        </button>
      </div>
    </div>
  );
}
