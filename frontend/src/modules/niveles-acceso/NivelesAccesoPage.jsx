import { Fragment, useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessLevelsApi } from '../../api/access-levels';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatCard from '../../components/StatCard';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import Breadcrumb from '../../core/ui/Breadcrumb';

// Solicitudes de "Mi Cuenta > Zona de riesgo" (baja de cuenta) que
// esperan revisión del Administrador — vive acá porque este ya es el
// rincón de la app donde el Administrador gestiona a otros usuarios,
// en vez de crear una pantalla nueva solo para esto.
function DeletionRequestsPanel() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({
    queryKey: ['account', 'deletion-requests'],
    queryFn: () => accountApi.listDeletionRequests({ status: 'PENDING' }),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, approve, note }) => accountApi.decideDeletion(id, approve, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'deletion-requests'] }),
  });

  async function handleDecide(request, approve) {
    const ok = await confirm({
      title: approve ? 'Aprobar baja de cuenta' : 'Rechazar solicitud de baja',
      message: approve
        ? `${request.user.name} quedará desactivado — ya no podrá iniciar sesión. Esto se puede revertir después reactivándolo.`
        : `${request.user.name} sigue activo con normalidad; se le avisa que su solicitud fue rechazada.`,
      confirmLabel: approve ? 'Aprobar' : 'Rechazar',
      tone: approve ? 'danger' : 'default',
    });
    if (!ok) return;
    decideMutation.mutate({ id: request.id, approve });
  }

  if (requestsQuery.isLoading) return null;
  if (!requestsQuery.data || requestsQuery.data.length === 0) return null;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Solicitudes de baja de cuenta
          <HelpTooltip text="Cuando alguien pide dar de baja su cuenta desde Mi Cuenta, aparece acá — aprobarla lo desactiva, rechazarla lo deja como estaba." />
        </h2>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Motivo</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {requestsQuery.data.map((req) => (
            <tr key={req.id}>
              <td>
                {req.user.name} <span className="text-muted">({req.user.email})</span>
              </td>
              <td>{req.reason || '—'}</td>
              <td>{formatDate(new Date(req.requestedAt))}</td>
              <td>
                <div className="btn-row">
                  <button type="button" className="btn btn-small btn-danger" onClick={() => handleDecide(req, true)}>
                    Aprobar
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => handleDecide(req, false)}>
                    Rechazar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROLE_LABELS = {
  ADMIN: 'Administrador',
  ACCOUNTANT: 'Contador',
  FINANCE: 'Financiero',
  COLLABORATOR: 'Colaborador',
};

const EMPTY_INVITE_FORM = { email: '', name: '', role: 'COLLABORATOR' };

export default function NivelesAccesoPage() {
  const { user } = useAuth();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [quotas, setQuotas] = useState([]);
  const [delegatedPermissions, setDelegatedPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM);
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const [expandedUserId, setExpandedUserId] = useState(null);
  const [roleDraft, setRoleDraft] = useState('');
  const [rowError, setRowError] = useState({});
  const [isSavingRow, setIsSavingRow] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [usersData, quotasData, delegatedData] = await Promise.all([
        accessLevelsApi.listUsers(),
        accessLevelsApi.quotas(),
        accessLevelsApi.listDelegatedPermissions(),
      ]);
      setUsers(usersData);
      setQuotas(quotasData);
      setDelegatedPermissions(delegatedData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar Niveles de Acceso.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function quotaFor(role) {
    return quotas.find((q) => q.role === role);
  }

  function hasDelegatedAccess(userId) {
    return delegatedPermissions.some(
      (grant) => grant.userId === userId && grant.permissionKey === 'ACCESS_LEVELS' && grant.isActive
    );
  }

  async function handleInvite(event) {
    event.preventDefault();
    setInviteError('');
    setInviteResult(null);
    setIsInviting(true);
    try {
      const result = await accessLevelsApi.inviteUser(inviteForm);
      setInviteResult(result);
      setInviteForm(EMPTY_INVITE_FORM);
      await load();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'No se pudo enviar la invitación.');
    } finally {
      setIsInviting(false);
    }
  }

  function toggleExpand(targetUser) {
    if (expandedUserId === targetUser.id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(targetUser.id);
    setRoleDraft(targetUser.role);
    setRowError((prev) => ({ ...prev, [targetUser.id]: '' }));
  }

  async function handleChangeRole(targetUser) {
    if (roleDraft === targetUser.role) return;
    const ok = await confirm({
      title: 'Cambiar rol de usuario',
      message: `Vas a cambiar a ${targetUser.name} de ${ROLE_LABELS[targetUser.role]} a ${ROLE_LABELS[roleDraft]}. Esto cambia de inmediato a qué partes del sistema puede entrar.`,
      confirmLabel: 'Cambiar rol',
      tone: 'danger',
    });
    if (!ok) return;

    setIsSavingRow(true);
    setRowError((prev) => ({ ...prev, [targetUser.id]: '' }));
    try {
      await accessLevelsApi.changeRole(targetUser.id, roleDraft);
      await load();
      setExpandedUserId(null);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [targetUser.id]: err instanceof ApiError ? err.message : 'No se pudo cambiar el rol.',
      }));
    } finally {
      setIsSavingRow(false);
    }
  }

  async function handleToggleActive(targetUser) {
    const willDeactivate = targetUser.status === 'ACTIVE';
    const ok = await confirm({
      title: willDeactivate ? 'Desactivar usuario' : 'Activar usuario',
      message: willDeactivate
        ? `${targetUser.name} ya no podrá iniciar sesión hasta que lo actives de nuevo.`
        : `${targetUser.name} va a poder iniciar sesión de nuevo con su rol actual (${ROLE_LABELS[targetUser.role]}).`,
      confirmLabel: willDeactivate ? 'Desactivar' : 'Activar',
      tone: willDeactivate ? 'danger' : 'default',
    });
    if (!ok) return;

    setRowError((prev) => ({ ...prev, [targetUser.id]: '' }));
    try {
      if (willDeactivate) {
        await accessLevelsApi.deactivateUser(targetUser.id);
      } else {
        await accessLevelsApi.activateUser(targetUser.id);
      }
      await load();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [targetUser.id]: err instanceof ApiError ? err.message : 'No se pudo cambiar el estado del usuario.',
      }));
    }
  }

  async function handleToggleDelegatedAccess(targetUser) {
    const isGranted = hasDelegatedAccess(targetUser.id);
    const ok = await confirm({
      title: isGranted ? 'Quitar acceso a Niveles de Acceso' : 'Dar acceso a Niveles de Acceso',
      message: isGranted
        ? `${targetUser.name} ya no podrá entrar a Niveles de Acceso, aunque siga siendo Contador.`
        : `${targetUser.name} va a poder entrar a Niveles de Acceso, como excepción puntual — su rol sigue siendo Contador.`,
      confirmLabel: isGranted ? 'Quitar acceso' : 'Dar acceso',
      tone: isGranted ? 'danger' : 'default',
    });
    if (!ok) return;

    setRowError((prev) => ({ ...prev, [targetUser.id]: '' }));
    try {
      if (isGranted) {
        await accessLevelsApi.revokeDelegatedPermission(targetUser.id, 'ACCESS_LEVELS');
      } else {
        await accessLevelsApi.grantDelegatedPermission(targetUser.id, 'ACCESS_LEVELS');
      }
      await load();
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [targetUser.id]: err instanceof ApiError ? err.message : 'No se pudo cambiar el permiso delegado.',
      }));
    }
  }

  const roleOptionsForInvite = Object.keys(ROLE_LABELS).map((role) => {
    const status = quotaFor(role);
    const isFull = status?.isFull;
    return { role, isFull, status };
  });

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Niveles de Acceso' }]} />
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Cupos por rol
            <HelpTooltip text="Cada rol tiene un número máximo de usuarios activos al mismo tiempo. Si un rol ya está lleno, primero hay que desactivar o cambiar de rol a alguien antes de invitar a alguien más con ese rol." />
          </h2>
        </div>
        <section className="dashboard-stats">
          {quotas.map((q) => (
            <StatCard
              key={q.role}
              label={ROLE_LABELS[q.role] || q.role}
              value={q.quota == null ? `${q.used} (sin límite)` : `${q.used} / ${q.quota} usados`}
              tone={q.isFull ? 'negative' : 'neutral'}
              hint={q.isFull ? 'Cupo lleno.' : null}
              isLoading={isLoading}
            />
          ))}
        </section>
      </div>

      {user?.role === 'ADMIN' && <DeletionRequestsPanel />}

      <div className="panel">
        <div className="panel-header">
          <h2>Usuarios de la empresa</h2>
          <button type="button" className="btn btn-primary btn-small" onClick={() => setIsInviteOpen((v) => !v)}>
            {isInviteOpen ? 'Cancelar' : '+ Invitar usuario'}
          </button>
        </div>

        {isInviteOpen && (
          <form onSubmit={handleInvite} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Correo</span>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">
                  Rol
                  <HelpTooltip text="Define a qué módulos puede entrar la persona invitada y qué puede hacer en cada uno. Un rol con el cupo lleno aparece deshabilitado." />
                </span>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                >
                  {roleOptionsForInvite.map(({ role, isFull }) => (
                    <option key={role} value={role} disabled={isFull}>
                      {ROLE_LABELS[role]}
                      {isFull ? ' — cupo lleno' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {inviteError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {inviteError}
              </p>
            )}
            {inviteResult && (
              <p className="alert-box alert-box-success" style={{ marginTop: 12 }}>
                Invitación creada para {inviteResult.user.email}. Por ahora el enlace no se envía por correo
                automáticamente — cópialo y compártelo a mano para que esa persona pueda crear su contraseña
                y entrar.{' '}
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={async () => {
                    const url = `${window.location.origin}/aceptar-invitacion?token=${inviteResult.invitationToken}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      setInviteLinkCopied(true);
                      setTimeout(() => setInviteLinkCopied(false), 2500);
                    } catch {
                      window.prompt('Copia este enlace de invitación:', url);
                    }
                  }}
                >
                  {inviteLinkCopied ? 'Copiado ✓' : 'Copiar enlace de invitación'}
                </button>
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isInviting}>
                {isInviting ? 'Enviando…' : 'Invitar usuario'}
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && users.length === 0 && (
          <EmptyState icon="◈" message="Todavía no hay usuarios registrados." />
        )}
        {!isLoading && !loadError && users.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Fecha de ingreso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      {ROLE_LABELS[u.role] || u.role}
                      {u.role === 'ACCOUNTANT' && hasDelegatedAccess(u.id) && (
                        <span className="text-muted" style={{ marginLeft: 6, fontSize: 'var(--text-2xs)' }}>
                          (con acceso a Niveles de Acceso)
                        </span>
                      )}
                    </td>
                    <td>
                      {u.status === 'INVITED' && <StatusSeal status="pending" label="Invitado, sin aceptar" />}
                      {u.status === 'ACTIVE' && <StatusSeal status="active" label="Activo" />}
                      {u.status === 'INACTIVE' && <StatusSeal status="inactive" label="Inactivo" />}
                    </td>
                    <td>{formatDate(new Date(u.createdAt))}</td>
                    <td>
                      {u.id !== user?.id && (
                        <button type="button" className="btn btn-small" onClick={() => toggleExpand(u)}>
                          {expandedUserId === u.id ? 'Cerrar' : 'Gestionar acceso'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedUserId === u.id && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--color-bg)' }}>
                        <div className="form-grid" style={{ alignItems: 'flex-end' }}>
                          <label className="field">
                            <span>Cambiar rol</span>
                            <select value={roleDraft} onChange={(e) => setRoleDraft(e.target.value)}>
                              {Object.keys(ROLE_LABELS).map((role) => {
                                const status = quotaFor(role);
                                const isFull = status?.isFull && role !== u.role;
                                return (
                                  <option key={role} value={role} disabled={isFull}>
                                    {ROLE_LABELS[role]}
                                    {isFull ? ' — cupo lleno' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          <div className="btn-row">
                            <button
                              type="button"
                              className="btn btn-primary btn-small"
                              disabled={roleDraft === u.role || isSavingRow || u.status === 'INVITED'}
                              onClick={() => handleChangeRole(u)}
                            >
                              Guardar rol
                            </button>
                            {u.status !== 'INVITED' && (
                              <button
                                type="button"
                                className={`btn btn-small ${u.status === 'ACTIVE' ? 'btn-danger' : ''}`}
                                onClick={() => handleToggleActive(u)}
                              >
                                {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                              </button>
                            )}
                            {u.role === 'ACCOUNTANT' && (
                              <button type="button" className="btn btn-small" onClick={() => handleToggleDelegatedAccess(u)}>
                                {hasDelegatedAccess(u.id) ? 'Quitar acceso a Niveles de Acceso' : 'Dar acceso a Niveles de Acceso'}
                              </button>
                            )}
                          </div>
                        </div>
                        {u.status === 'INVITED' && (
                          <p className="text-muted" style={{ marginTop: 8 }}>
                            Este usuario todavía no aceptó su invitación — no se le puede cambiar el rol ni activar hasta que lo haga.
                          </p>
                        )}
                        {rowError[u.id] && (
                          <p className="alert-box alert-box-error" style={{ marginTop: 8 }}>
                            {rowError[u.id]}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
