import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import './LoginPage.css';

export default function LoginPage() {
  const { login, completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingToken, setPendingToken] = useState('');
  const [code, setCode] = useState('');

  const redirectTo = location.state?.from || '/';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result?.requiresTwoFactor) {
        setPendingToken(result.pendingToken);
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await completeTwoFactorLogin(pendingToken, code);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pendingToken) {
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

          <h1 className="login-title">Verificación en dos pasos</h1>
          <p className="login-subtitle">Escribe el código de 6 dígitos de tu app autenticadora.</p>

          <form className="login-form" onSubmit={handleVerifyCode}>
            <label className="login-field">
              <span>Código</span>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                autoFocus
                required
              />
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="submit" className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Verificando…' : 'Verificar'}
            </button>
            <button
              type="button"
              className="login-submit"
              style={{ marginTop: 8, background: 'transparent', border: '1px solid var(--color-border)' }}
              onClick={() => {
                setPendingToken('');
                setCode('');
                setError('');
              }}
            >
              Volver
            </button>
          </form>
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

        <h1 className="login-title">Iniciar sesión</h1>
        <p className="login-subtitle">Ingresa con tu correo y contraseña de la empresa.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@empresa.com"
              autoComplete="username"
              required
            />
          </label>

          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
