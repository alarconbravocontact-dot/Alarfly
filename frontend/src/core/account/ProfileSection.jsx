import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../../api/account';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import HelpTooltip from '../../components/HelpTooltip';
import ValidatedField from '../ui/ValidatedField';
import { validateRif } from '../../utils/fieldValidators';
import { TIMEZONE_OPTIONS } from '../../utils/timezones';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfileSection() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const profileQuery = useQuery({ queryKey: ['account', 'profile'], queryFn: accountApi.getProfile });
  const companyQuery = useQuery({ queryKey: ['account', 'company-profile'], queryFn: accountApi.getCompanyProfile });

  const [form, setForm] = useState({ name: '', phone: '' });
  const [companyForm, setCompanyForm] = useState({
    name: '',
    rif: '',
    website: '',
    address: '',
    postalCode: '',
    usesInventory: true,
    dueDateWarningThresholdDays: 7,
    fiscalYearStartMonth: 1,
    defaultLanguage: 'es',
    defaultDateFormat: 'DD/MM/YYYY',
    defaultTimeZone: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarError, setAvatarError] = useState('');

  useEffect(() => {
    if (profileQuery.data) setForm({ name: profileQuery.data.name, phone: profileQuery.data.phone || '' });
  }, [profileQuery.data]);

  useEffect(() => {
    if (companyQuery.data) {
      setCompanyForm({
        name: companyQuery.data.name,
        rif: companyQuery.data.rif || '',
        website: companyQuery.data.website || '',
        address: companyQuery.data.address || '',
        postalCode: companyQuery.data.postalCode || '',
        usesInventory: companyQuery.data.usesInventory,
        dueDateWarningThresholdDays: companyQuery.data.dueDateWarningThresholdDays,
        fiscalYearStartMonth: companyQuery.data.fiscalYearStartMonth,
        defaultLanguage: companyQuery.data.defaultLanguage,
        defaultDateFormat: companyQuery.data.defaultDateFormat,
        defaultTimeZone: companyQuery.data.defaultTimeZone || '',
      });
    }
  }, [companyQuery.data]);

  const updateProfile = useMutation({
    mutationFn: () => accountApi.updateProfile(form),
    onSuccess: (updated) => {
      queryClient.setQueryData(['account', 'profile'], updated);
      refreshUser({ name: updated.name });
    },
  });

  const updateCompanyProfile = useMutation({
    mutationFn: () => accountApi.updateCompanyProfile(companyForm),
    onSuccess: (updated) => queryClient.setQueryData(['account', 'company-profile'], updated),
  });

  const uploadAvatar = useMutation({
    mutationFn: async () => {
      const contentBase64 = await readFileAsBase64(avatarFile);
      return accountApi.uploadAvatar({ fileName: avatarFile.name, mimeType: avatarFile.type, contentBase64 });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['account', 'profile'], updated);
      setAvatarFile(null);
      setAvatarError('');
    },
    onError: (err) => setAvatarError(err instanceof ApiError ? err.message : 'No se pudo subir la foto.'),
  });

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <h2>Datos personales</h2>
        </div>
        {profileQuery.isLoading && <p className="text-muted">Cargando…</p>}
        {profileQuery.isError && <p className="alert-box alert-box-error">No se pudieron cargar tus datos.</p>}
        {profileQuery.data && (
          <>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="field">
                <span>Correo</span>
                <input value={profileQuery.data.email} disabled />
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
            </div>
            {updateProfile.isError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {updateProfile.error instanceof ApiError ? updateProfile.error.message : 'No se pudo guardar.'}
              </p>
            )}
            {updateProfile.isSuccess && (
              <p className="alert-box alert-box-success" style={{ marginTop: 12 }}>
                Datos guardados correctamente.
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary btn-small"
                disabled={updateProfile.isPending}
                onClick={() => updateProfile.mutate()}
              >
                {updateProfile.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Foto de perfil</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Elegir imagen (PNG, JPG o WEBP)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        {profileQuery.data?.avatarFileName && (
          <p className="text-muted" style={{ marginTop: 8 }}>
            Foto actual: {profileQuery.data.avatarFileName}
          </p>
        )}
        {avatarError && (
          <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
            {avatarError}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-primary btn-small"
            disabled={!avatarFile || uploadAvatar.isPending}
            onClick={() => uploadAvatar.mutate()}
          >
            {uploadAvatar.isPending ? 'Subiendo…' : 'Subir foto'}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Perfil de la empresa
            <HelpTooltip text="Estos datos identifican a tu empresa (nombre, RIF, sitio web, dirección). Solo el Administrador puede editarlos." />
          </h2>
        </div>
        {companyQuery.isLoading && <p className="text-muted">Cargando…</p>}
        {companyQuery.data && (
          <>
            <div className="form-grid">
              <label className="field">
                <span>Nombre de la empresa</span>
                <input
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  disabled={!isAdmin}
                  required
                />
              </label>
              <ValidatedField
                label="RIF"
                value={companyForm.rif}
                onChange={(rif) => setCompanyForm({ ...companyForm, rif })}
                validate={validateRif}
                disabled={!isAdmin}
              />
              <label className="field">
                <span>Sitio web</span>
                <input
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                  disabled={!isAdmin}
                />
              </label>
              <label className="field">
                <span>Dirección</span>
                <input
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  disabled={!isAdmin}
                />
              </label>
              <label className="field">
                <span>Código postal</span>
                <input
                  value={companyForm.postalCode}
                  onChange={(e) => setCompanyForm({ ...companyForm, postalCode: e.target.value })}
                  disabled={!isAdmin}
                />
              </label>
            </div>
            <label className="field field-checkbox" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={!!companyForm.usesInventory}
                onChange={(e) => setCompanyForm({ ...companyForm, usesInventory: e.target.checked })}
                disabled={!isAdmin}
              />
              <span>
                Tu negocio vende productos físicos
                <HelpTooltip text="Si está marcado, la barra de configuración inicial del Panel principal te pedirá cargar tu primer producto. Si no, te pedirá registrar tu primer cliente." />
              </span>
            </label>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field">
                <span>
                  Días de aviso antes de vencer
                  <HelpTooltip text="Cuántos días antes de la fecha de vencimiento una factura, cuota u obligación se muestra en amarillo (próxima a vencer) en vez de verde. Pasada la fecha, siempre se ve en rojo." />
                </span>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={companyForm.dueDateWarningThresholdDays ?? ''}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, dueDateWarningThresholdDays: Number(e.target.value) })
                  }
                  disabled={!isAdmin}
                />
              </label>
              <label className="field">
                <span>
                  Mes en que arranca tu año fiscal
                  <HelpTooltip text="Si tu negocio cierra el año contable en un mes distinto a diciembre, indícalo acá — el atajo 'Año fiscal actual' del selector de fechas lo va a respetar en vez de asumir que siempre empieza en enero." />
                </span>
                <select
                  value={companyForm.fiscalYearStartMonth ?? 1}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, fiscalYearStartMonth: Number(e.target.value) })
                  }
                  disabled={!isAdmin}
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field">
                <span className="field-label">
                  Idioma de la empresa (por defecto)
                  <HelpTooltip text="El idioma que ve cualquier usuario que no haya elegido el suyo propio en sus propias preferencias. El ajuste personal de cada usuario siempre tiene prioridad sobre este." />
                </span>
                <select
                  value={companyForm.defaultLanguage}
                  onChange={(e) => setCompanyForm({ ...companyForm, defaultLanguage: e.target.value })}
                  disabled={!isAdmin}
                >
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Formato de fecha de la empresa (por defecto)
                  <HelpTooltip text="El formato de fecha que ve cualquier usuario que no haya elegido el suyo propio. El ajuste personal de cada usuario siempre tiene prioridad sobre este." />
                </span>
                <select
                  value={companyForm.defaultDateFormat}
                  onChange={(e) => setCompanyForm({ ...companyForm, defaultDateFormat: e.target.value })}
                  disabled={!isAdmin}
                >
                  <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                  <option value="MM/DD/YYYY">MM/DD/AAAA</option>
                  <option value="YYYY-MM-DD">AAAA-MM-DD</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Huso horario de la empresa (por defecto)
                  <HelpTooltip text="El huso horario que ve cualquier usuario que no haya elegido el suyo propio. El ajuste personal de cada usuario siempre tiene prioridad sobre este." />
                </span>
                <select
                  value={companyForm.defaultTimeZone}
                  onChange={(e) => setCompanyForm({ ...companyForm, defaultTimeZone: e.target.value || null })}
                  disabled={!isAdmin}
                >
                  <option value="">Sin definir</option>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!isAdmin && (
              <p className="text-muted" style={{ marginTop: 8 }}>
                Solo el Administrador puede editar estos datos.
              </p>
            )}
            {updateCompanyProfile.isError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {updateCompanyProfile.error instanceof ApiError ? updateCompanyProfile.error.message : 'No se pudo guardar.'}
              </p>
            )}
            {updateCompanyProfile.isSuccess && (
              <p className="alert-box alert-box-success" style={{ marginTop: 12 }}>
                Datos de la empresa guardados.
              </p>
            )}
            {isAdmin && (
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={updateCompanyProfile.isPending}
                  onClick={() => updateCompanyProfile.mutate()}
                >
                  {updateCompanyProfile.isPending ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
