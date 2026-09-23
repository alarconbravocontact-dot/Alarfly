import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useIncognito } from '../../context/IncognitoContext';
import { useIconLabel } from '../../context/IconLabelContext';
import HelpTooltip from '../../components/HelpTooltip';
import { buildTimeZoneOptions } from '../../utils/timezones';

const LANGUAGE_LABELS = { es: 'Español', en: 'Inglés' };
const DATE_FORMAT_LABELS = { 'DD/MM/YYYY': 'DD/MM/AAAA', 'MM/DD/YYYY': 'MM/DD/AAAA', 'YYYY-MM-DD': 'AAAA-MM-DD' };

// Innovación pedida explícitamente: el huso horario probable se
// detecta con la propia API del navegador (Intl.DateTimeFormat), no
// con geolocalización por IP — ese dato SÍ es real y honesto (refleja
// el huso configurado en el sistema operativo del usuario), a
// diferencia de una "ubicación aproximada" que este proyecto ya
// documentó como imposible de mostrar sin inventar un dato (ver
// CLAUDE.md, sesiones activas de Mi Cuenta).
function detectBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function ActiveCompanyPanel() {
  const { user, refreshUser } = useAuth();
  const companiesQuery = useQuery({ queryKey: ['account', 'companies'], queryFn: accountApi.listMyCompanies });

  const switchMutation = useMutation({
    mutationFn: (companyId) => accountApi.switchActiveCompany(companyId),
    onSuccess: (result) => refreshUser(result),
  });

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Empresa activa
          <HelpTooltip text="Si tienes acceso a más de una empresa, acá eliges con cuál estás trabajando ahora mismo." />
        </h2>
      </div>
      {companiesQuery.isLoading && <p className="text-muted">Cargando…</p>}
      {companiesQuery.data && (
        <>
          {companiesQuery.data.length <= 1 ? (
            <p className="text-muted">
              Solo tienes acceso a una empresa ({companiesQuery.data[0]?.company.name}). El Administrador puede darte
              acceso a otra si hace falta.
            </p>
          ) : (
            <div className="form-grid">
              <label className="field">
                <span>Empresa</span>
                <select
                  value={user?.companyId || ''}
                  onChange={(e) => switchMutation.mutate(e.target.value)}
                  disabled={switchMutation.isPending}
                >
                  {companiesQuery.data.map((access) => (
                    <option key={access.companyId} value={access.companyId}>
                      {access.company.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {switchMutation.isError && (
            <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
              {switchMutation.error instanceof ApiError ? switchMutation.error.message : 'No se pudo cambiar de empresa.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DisplayPreferencesPanel() {
  const queryClient = useQueryClient();
  const theme = useTheme();
  const preferencesQuery = useQuery({ queryKey: ['account', 'preferences'], queryFn: accountApi.getPreferences });

  const [form, setForm] = useState(null);
  const [themeSaveError, setThemeSaveError] = useState('');
  const detectedTimeZone = useMemo(detectBrowserTimeZone, []);

  useEffect(() => {
    if (preferencesQuery.data) {
      setForm({
        displayCurrency: preferencesQuery.data.displayCurrency || '',
        dateFormat: preferencesQuery.data.dateFormat || '',
        decimalSeparator: preferencesQuery.data.decimalSeparator,
        language: preferencesQuery.data.language || '',
        timeZone: preferencesQuery.data.timeZone || '',
      });
    }
  }, [preferencesQuery.data]);

  // El tema se aplica y guarda de inmediato al elegirlo (no espera al
  // botón "Guardar preferencias") — cambiar de tema es una acción que
  // se espera ver reflejada al instante, no después de un paso extra.
  async function handleThemeChange(newTheme) {
    setThemeSaveError('');
    try {
      await theme.setTheme(newTheme);
      queryClient.setQueryData(['account', 'preferences'], (prev) => (prev ? { ...prev, theme: newTheme } : prev));
    } catch (err) {
      setThemeSaveError(err instanceof ApiError ? err.message : 'No se pudo guardar el tema.');
    }
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      accountApi.updatePreferences({
        ...form,
        displayCurrency: form.displayCurrency || null,
        // Selector unificado de idioma/huso horario/formato regional:
        // vacío = "usar el de la empresa" (null explícito, ver
        // preferences.service.js) — mismo criterio ya usado con
        // displayCurrency arriba.
        dateFormat: form.dateFormat || null,
        language: form.language || null,
        timeZone: form.timeZone || null,
      }),
    onSuccess: (updated) => queryClient.setQueryData(['account', 'preferences'], updated),
  });

  const companyDefaults = preferencesQuery.data?.companyDefaults;
  const timeZoneOptions = buildTimeZoneOptions(detectedTimeZone);
  const suggestTimeZone =
    detectedTimeZone && form?.timeZone === '' && preferencesQuery.data?.timeZone == null && detectedTimeZone !== companyDefaults?.defaultTimeZone;

  if (!form) return preferencesQuery.isLoading ? <p className="text-muted">Cargando…</p> : null;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Preferencias de visualización</h2>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">
            Moneda de visualización
            <HelpTooltip text="Solo cambia cómo ves los montos en pantalla — déjalo vacío para usar la moneda de la empresa." />
          </span>
          <input
            value={form.displayCurrency}
            onChange={(e) => setForm({ ...form, displayCurrency: e.target.value.toUpperCase() })}
            placeholder="USD"
            maxLength={3}
          />
        </label>
        <label className="field">
          <span className="field-label">
            Formato de fecha
            <HelpTooltip text="'Usar el de la empresa' significa que este valor lo decide el Administrador (Mi Cuenta > Perfil de la empresa) — en cuanto elijas uno propio acá, el tuyo manda siempre, sin importar lo que diga la empresa." />
          </span>
          <select value={form.dateFormat} onChange={(e) => setForm({ ...form, dateFormat: e.target.value })}>
            <option value="">Usar el de la empresa ({DATE_FORMAT_LABELS[companyDefaults?.defaultDateFormat] || companyDefaults?.defaultDateFormat})</option>
            <option value="DD/MM/YYYY">DD/MM/AAAA</option>
            <option value="MM/DD/YYYY">MM/DD/AAAA</option>
            <option value="YYYY-MM-DD">AAAA-MM-DD</option>
          </select>
        </label>
        <label className="field">
          <span>Separador decimal</span>
          <select value={form.decimalSeparator} onChange={(e) => setForm({ ...form, decimalSeparator: e.target.value })}>
            <option value=",">Coma (1.000,00)</option>
            <option value=".">Punto (1,000.00)</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">
            Idioma
            <HelpTooltip text="'Usar el de la empresa' significa que este valor lo decide el Administrador — en cuanto elijas uno propio acá, el tuyo manda siempre." />
          </span>
          <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
            <option value="">Usar el de la empresa ({LANGUAGE_LABELS[companyDefaults?.defaultLanguage] || companyDefaults?.defaultLanguage})</option>
            <option value="es">Español</option>
            <option value="en">Inglés</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">
            Huso horario
            <HelpTooltip text="'Usar el de la empresa' significa que este valor lo decide el Administrador — en cuanto elijas uno propio acá, el tuyo manda siempre." />
          </span>
          <select value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })}>
            <option value="">
              Usar el de la empresa {companyDefaults?.defaultTimeZone ? `(${companyDefaults.defaultTimeZone})` : '(sin definir)'}
            </option>
            {timeZoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {suggestTimeZone && (
            <p className="text-muted" style={{ marginTop: 4, fontSize: 'var(--text-2xs, 0.75rem)' }}>
              Detectamos que tu huso horario probable es <strong>{detectedTimeZone}</strong>.{' '}
              <button
                type="button"
                className="btn btn-small"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setForm({ ...form, timeZone: detectedTimeZone })}
              >
                Usar esta sugerencia
              </button>
            </p>
          )}
        </label>
        <label className="field">
          <span className="field-label">
            Tema
            <HelpTooltip text="Se guarda por tu usuario, no por este equipo — al iniciar sesión desde otro computador vas a ver el mismo tema. 'Automático' sigue el horario/ajuste de tu sistema operativo, y se actualiza solo si lo cambias mientras tienes la aplicación abierta." />
          </span>
          <select value={theme.rawTheme} onChange={(e) => handleThemeChange(e.target.value)}>
            <option value="dark">Oscuro</option>
            <option value="light">Claro</option>
            <option value="auto">Automático (sigue tu sistema)</option>
          </select>
        </label>
      </div>
      {themeSaveError && (
        <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
          {themeSaveError}
        </p>
      )}
      {updateMutation.isSuccess && (
        <p className="alert-box alert-box-success" style={{ marginTop: 12 }}>
          Preferencias guardadas.
        </p>
      )}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate()}
        >
          {updateMutation.isPending ? 'Guardando…' : 'Guardar preferencias'}
        </button>
      </div>
    </div>
  );
}

function IncognitoPanel() {
  const { isIncognito, toggle, autoOnScreenShare, setAutoOnScreenShareSetting, isSharingThisTab, startWatchingThisTab, stopWatchingThisTab, canDetectScreenShare } =
    useIncognito();
  const [error, setError] = useState('');

  async function handleWatchClick() {
    setError('');
    try {
      await startWatchingThisTab();
    } catch {
      // El usuario canceló el selector nativo del navegador, o lo
      // rechazó — no es un error real que haya que mostrar.
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Modo incógnito
          <HelpTooltip text="Reemplaza todos los montos visibles por asteriscos. Actívalo/desactívalo con el ícono de ojo de la barra superior, o con el atajo Ctrl+Shift+H (Cmd+Shift+H en Mac)." />
        </h2>
      </div>
      <label className="field field-checkbox">
        <input type="checkbox" checked={isIncognito} onChange={toggle} />
        <span>Modo incógnito activo ahora mismo</span>
      </label>
      <label className="field field-checkbox" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={autoOnScreenShare}
          onChange={(e) => setAutoOnScreenShareSetting(e.target.checked)}
        />
        <span className="field-label">
          Activar automáticamente al compartir esta pestaña
          <HelpTooltip text="Los navegadores no dejan que una página sepa si la están compartiendo desde OTRA pestaña o aplicación (Zoom, Meet, Teams) — es una barrera de privacidad del propio navegador. Lo que sí se puede detectar de verdad es cuando TÚ eliges compartir específicamente esta pestaña de Alarfly desde el selector nativo del navegador." />
        </span>
      </label>
      {autoOnScreenShare && canDetectScreenShare && (
        <div style={{ marginTop: 12 }}>
          {!isSharingThisTab ? (
            <button type="button" className="btn btn-small" onClick={handleWatchClick}>
              Vigilar esta pestaña mientras la compartes
            </button>
          ) : (
            <>
              <p className="alert-box alert-box-success" style={{ marginBottom: 8 }}>
                Vigilando — el modo incógnito se activó solo y se desactivará cuando dejes de compartir esta pestaña.
              </p>
              <button type="button" className="btn btn-small" onClick={stopWatchingThisTab}>
                Dejar de vigilar
              </button>
            </>
          )}
          <p className="text-muted" style={{ marginTop: 8, fontSize: 'var(--text-2xs, 0.75rem)' }}>
            Al hacer clic, el navegador te pedirá elegir qué compartir — elige "Esta pestaña" para que funcione.
          </p>
        </div>
      )}
      {autoOnScreenShare && !canDetectScreenShare && (
        <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
          Tu navegador no soporta la API de compartir pantalla — esta función no está disponible acá.
        </p>
      )}
      {error && (
        <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}

function IconLabelPanel() {
  const { beginnerMode, setBeginnerMode } = useIconLabel();

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Íconos
          <HelpTooltip text="Los íconos de la aplicación (campana de notificaciones, ojo de modo incógnito, etc.) usan siempre el mismo estilo de trazo. El modo principiante les agrega una etiqueta de texto al lado, para aprender qué hace cada uno más rápido." />
        </h2>
      </div>
      <label className="field field-checkbox">
        <input type="checkbox" checked={beginnerMode} onChange={(e) => setBeginnerMode(e.target.checked)} />
        <span className="field-label">
          Mostrar etiquetas de texto junto a los íconos (modo principiante)
          <HelpTooltip text="Actívalo si todavía no reconoces qué hace cada ícono — cada uno mostrará también su nombre. Desactívalo cuando ya los tengas identificados, para una vista más limpia." />
        </span>
      </label>
    </div>
  );
}

export default function PreferencesSection() {
  return (
    <div>
      <ActiveCompanyPanel />
      <DisplayPreferencesPanel />
      <IncognitoPanel />
      <IconLabelPanel />
    </div>
  );
}
