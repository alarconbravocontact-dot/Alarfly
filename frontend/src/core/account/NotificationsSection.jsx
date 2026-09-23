import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../../api/account';
import HelpTooltip from '../../components/HelpTooltip';

export default function NotificationsSection() {
  const queryClient = useQueryClient();
  const prefsQuery = useQuery({
    queryKey: ['account', 'notification-preferences'],
    queryFn: accountApi.listNotificationPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: ({ alertType, data }) => accountApi.updateNotificationPreference(alertType, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'notification-preferences'] }),
  });

  function toggle(pref, field) {
    updateMutation.mutate({
      alertType: pref.alertType,
      data: {
        emailEnabled: field === 'email' ? !pref.emailEnabled : pref.emailEnabled,
        pushEnabled: field === 'push' ? !pref.pushEnabled : pref.pushEnabled,
        inAppEnabled: field === 'inApp' ? !pref.inAppEnabled : pref.inAppEnabled,
      },
    });
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Notificaciones
          <HelpTooltip text="Qué tipos de alerta quieres recibir y por qué canal. Desactivar “En la aplicación” para un tipo que no te toca (ej. Stock bajo si no manejas inventario) evita que te distraiga en el Centro de Notificaciones — sigue disponible para quien sí lo necesite. El envío por correo y por push todavía no están conectados en el sistema — los interruptores quedan guardados, listos para cuando se activen." />
        </h2>
      </div>

      {prefsQuery.isLoading && <p className="text-muted">Cargando…</p>}
      {prefsQuery.data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo de alerta</th>
              <th>En la aplicación</th>
              <th>Por correo</th>
              <th>Por push</th>
            </tr>
          </thead>
          <tbody>
            {prefsQuery.data.map((pref) => (
              <tr key={pref.alertType}>
                <td>{pref.label}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={pref.inAppEnabled}
                    onChange={() => toggle(pref, 'inApp')}
                    disabled={updateMutation.isPending}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={pref.emailEnabled}
                    onChange={() => toggle(pref, 'email')}
                    disabled={updateMutation.isPending}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={pref.pushEnabled}
                    onChange={() => toggle(pref, 'push')}
                    disabled={updateMutation.isPending}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
