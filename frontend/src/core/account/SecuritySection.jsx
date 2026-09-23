import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [success, setSuccess] = useState(false);

  const changePassword = useMutation({
    mutationFn: () => accountApi.changePassword(form),
    onSuccess: () => {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(true);
    },
    onSettled: () => setSuccess(false),
  });

  function handleSubmit(event) {
    event.preventDefault();
    setSuccess(false);
    changePassword.mutate();
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Cambiar contraseña
          <HelpTooltip text="La contraseña nueva debe tener al menos 8 caracteres, con mayúscula, minúscula y número." />
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="form-grid">
        <label className="field">
          <span>Contraseña actual</span>
          <input
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Contraseña nueva</span>
          <input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Confirmar contraseña nueva</span>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
          />
        </label>
        {changePassword.isError && (
          <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
            {changePassword.error instanceof ApiError ? changePassword.error.message : 'No se pudo cambiar la contraseña.'}
          </p>
        )}
        {success && (
          <p className="alert-box alert-box-success" style={{ gridColumn: '1 / -1' }}>
            Contraseña actualizada correctamente.
          </p>
        )}
        <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="btn btn-primary btn-small" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
}

function TwoFactorPanel() {
  const queryClient = useQueryClient();

  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [disableError, setDisableError] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);

  const setupMutation = useMutation({
    mutationFn: accountApi.setupTwoFactor,
    onSuccess: (data) => {
      setSetupData(data);
      setVerifyError('');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => accountApi.verifyTwoFactorSetup(verifyCode),
    onSuccess: () => {
      setSetupData(null);
      setVerifyCode('');
      queryClient.invalidateQueries({ queryKey: ['account', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['account', 'two-factor'] });
    },
    onError: (err) => setVerifyError(err instanceof ApiError ? err.message : 'No se pudo verificar el código.'),
  });

  async function handleDisable(event) {
    event.preventDefault();
    setDisableError('');
    setIsDisabling(true);
    try {
      await accountApi.disableTwoFactor(disableForm.password, disableForm.code);
      setDisableForm({ password: '', code: '' });
      queryClient.invalidateQueries({ queryKey: ['account', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['account', 'two-factor'] });
    } catch (err) {
      setDisableError(err instanceof ApiError ? err.message : 'No se pudo desactivar.');
    } finally {
      setIsDisabling(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Verificación en dos pasos (2FA)
          <HelpTooltip text="Un código adicional de 6 dígitos, generado por una app como Google Authenticator, que se pide al iniciar sesión además de tu contraseña." />
        </h2>
      </div>

      {!setupData && (
        <TwoFactorStatus
          onSetup={() => setupMutation.mutate()}
          isSettingUp={setupMutation.isPending}
          disableForm={disableForm}
          setDisableForm={setDisableForm}
          disableError={disableError}
          isDisabling={isDisabling}
          onDisable={handleDisable}
        />
      )}

      {setupData && (
        <div>
          <p>Escanea este código QR con tu app autenticadora, o escribe la clave a mano:</p>
          <img src={setupData.qrDataUrl} alt="Código QR para configurar 2FA" style={{ width: 180, height: 180, marginBottom: 8 }} />
          <p className="text-muted">
            Clave manual: <code>{setupData.secret}</code>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyMutation.mutate();
            }}
            className="form-grid"
            style={{ marginTop: 12 }}
          >
            <label className="field">
              <span>Código de tu app</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                required
              />
            </label>
            {verifyError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {verifyError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary btn-small" disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? 'Verificando…' : 'Activar'}
              </button>
              <button type="button" className="btn btn-small" onClick={() => setSetupData(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Envuelto aparte porque necesita saber si 2FA ya está activo, y el
// endpoint de perfil no trae ese campo — se resuelve probando a listar
// sesiones no aplica; en vez de eso, esta pieza pide el estado real
// con una llamada dedicada y liviana.
function TwoFactorStatus({ onSetup, isSettingUp, disableForm, setDisableForm, disableError, isDisabling, onDisable }) {
  const statusQuery = useQuery({
    queryKey: ['account', 'two-factor'],
    queryFn: accountApi.getProfile,
  });

  if (statusQuery.isLoading) return <p className="text-muted">Cargando…</p>;

  const enabled = Boolean(statusQuery.data?.twoFactorEnabled);

  if (!enabled) {
    return (
      <div>
        <StatusSeal status="inactive" label="Desactivada" />
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary btn-small" disabled={isSettingUp} onClick={onSetup}>
            {isSettingUp ? 'Generando…' : 'Activar verificación en dos pasos'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StatusSeal status="active" label="Activada" />
      <p className="text-muted" style={{ marginTop: 8 }}>
        Para desactivarla, confirma tu contraseña y un código actual de tu app.
      </p>
      <form onSubmit={onDisable} className="form-grid" style={{ marginTop: 8 }}>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={disableForm.password}
            onChange={(e) => setDisableForm({ ...disableForm, password: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Código de tu app</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={disableForm.code}
            onChange={(e) => setDisableForm({ ...disableForm, code: e.target.value })}
            required
          />
        </label>
        {disableError && (
          <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
            {disableError}
          </p>
        )}
        <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="btn btn-small btn-danger" disabled={isDisabling}>
            {isDisabling ? 'Desactivando…' : 'Desactivar verificación en dos pasos'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SessionsPanel() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({ queryKey: ['account', 'sessions'], queryFn: accountApi.listSessions });

  const revokeMutation = useMutation({
    mutationFn: (id) => accountApi.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'sessions'] }),
  });

  async function handleRevoke(session) {
    const ok = await confirm({
      title: 'Cerrar sesión',
      message: session.isCurrent
        ? 'Esta es tu sesión actual — si la cierras, tendrás que iniciar sesión de nuevo.'
        : `Vas a cerrar la sesión de ${session.deviceInfo || 'ese dispositivo'}. Esa sesión ya no podrá usarse.`,
      confirmLabel: 'Cerrar sesión',
      tone: 'danger',
    });
    if (!ok) return;
    revokeMutation.mutate(session.id);
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Sesiones activas
          <HelpTooltip text="Cada vez que inicias sesión en un dispositivo o navegador queda una entrada acá. Puedes cerrar cualquiera de forma remota si no la reconoces." />
        </h2>
      </div>
      {sessionsQuery.isLoading && <p className="text-muted">Cargando…</p>}
      {sessionsQuery.data && sessionsQuery.data.length === 0 && (
        <EmptyState icon="⎋" message="No hay sesiones activas." />
      )}
      {sessionsQuery.data && sessionsQuery.data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Dispositivo</th>
              <th>Dirección IP</th>
              <th>Inicio</th>
              <th>Última actividad</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessionsQuery.data.map((s) => (
              <tr key={s.id}>
                <td>{s.deviceInfo || 'Desconocido'}</td>
                <td>{s.ipAddress || '—'}</td>
                <td>{formatDate(new Date(s.createdAt))}</td>
                <td>{formatDate(new Date(s.lastSeenAt))}</td>
                <td>{s.isCurrent && <StatusSeal status="active" label="Esta sesión" />}</td>
                <td>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => handleRevoke(s)}>
                    Cerrar sesión
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function SecuritySection() {
  return (
    <div>
      <PasswordForm />
      <TwoFactorPanel />
      <SessionsPanel />
    </div>
  );
}
