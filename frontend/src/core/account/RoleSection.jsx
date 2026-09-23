import { useQuery } from '@tanstack/react-query';
import { accountApi } from '../../api/account';
import StatusSeal from '../../core/ui/StatusSeal';

export default function RoleSection() {
  const roleQuery = useQuery({ queryKey: ['account', 'role'], queryFn: accountApi.getMyRole });

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Mi rol y permisos</h2>
      </div>
      <p className="text-muted">
        Esto es de solo lectura — tu rol lo asigna el Administrador desde Niveles de Acceso, no se cambia acá.
      </p>

      {roleQuery.isLoading && <p className="text-muted">Cargando…</p>}
      {roleQuery.data && (
        <>
          <p style={{ marginTop: 12 }}>
            Tu rol actual: <strong>{roleQuery.data.roleLabel}</strong>
          </p>

          {roleQuery.data.delegatedPermissions.length > 0 && (
            <p className="text-muted">
              Además tienes un permiso especial otorgado: {roleQuery.data.delegatedPermissions.join(', ')}.
            </p>
          )}

          <table className="data-table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Módulo</th>
                <th>Acceso</th>
              </tr>
            </thead>
            <tbody>
              {roleQuery.data.moduleAccess.map((m) => (
                <tr key={m.module}>
                  <td>{m.label}</td>
                  <td>
                    {m.hasAccess ? (
                      <StatusSeal status="active" label="Tienes acceso" />
                    ) : (
                      <StatusSeal status="inactive" label="Sin acceso" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
