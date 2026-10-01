import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import './LoginPage.css';

// F17-E8: bug real de severidad alta encontrado auditando "Gestión de
// Equipo" con una empresa real — Niveles de Acceso ya generaba el
// token de invitación y el backend (`POST /auth/accept-invitation`)
// estaba completo y probado desde que se construyó ese módulo, pero
// no existía NINGUNA pantalla para que la persona invitada lo usara —
// el token solo se mostraba como texto crudo para "copiar y compartir
// a mano", sin ningún lugar donde pegarlo. Un Administrador podía
// invitar a alguien, pero esa persona nunca podía entrar.
export default function AcceptInvitationPage() {
  const { acceptInvitation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setIsSubmitting(true);
    try {
      await acceptInvitation(token, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <span className="login-brand-mark">A</span>
            <div>
              <p className="login-brand-name">Alarfly</p>
              <p className="login-brand-tagline">Gestión financiera integral</p>
            </div>
          </div>
          <h1 className="login-title">Enlace de invitación incompleto</h1>
          <p className="login-subtitle">
            Este enlace no trae el código de invitación. Pide a quien te invitó que te lo vuelva a compartir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark">A</span>
          <div>
            <p className="login-brand-name">Alarfly</p>
            <p className="login-brand-tagline">Gestión financiera integral</p>
          </div>
        </div>

        <h1 className="login-title">Crea tu contraseña</h1>
        <p className="login-subtitle">Te invitaron a Alarfly — elige una contraseña para activar tu cuenta.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label className="login-field">
            <span>Confirma tu contraseña</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Activando…' : 'Activar mi cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
