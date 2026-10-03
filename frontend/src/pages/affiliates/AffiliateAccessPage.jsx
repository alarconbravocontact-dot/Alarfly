import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAffiliateAuth } from '../../context/AffiliateAuthContext';
import { AffiliateApiError } from '../../api/affiliateAuth';
import '../LoginPage.css';

// Acceso público del programa de afiliados — reutiliza EXACTAMENTE las
// mismas clases `login-*` que ya usa LoginPage.jsx (mismo sistema de
// diseño, misma tarjeta centrada), a propósito: es una puerta de
// acceso más, no una pantalla nueva de otro producto. Alterna entre
// "Ya soy afiliado" (login) y "Quiero ser afiliado" (registro) en la
// misma pantalla, mismo patrón ya usado por LoginPage con el segundo
// paso de 2FA.
export default function AffiliateAccessPage() {
  const { login, register } = useAffiliateAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        await register(name, email, password, phone);
      } else {
        await login(email, password);
      }
      navigate('/afiliados/panel', { replace: true });
    } catch (err) {
      setError(err instanceof AffiliateApiError ? err.message : 'No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark">A</span>
          <div>
            <p className="login-brand-name">Alarfly</p>
            <p className="login-brand-tagline">Programa de Afiliados</p>
          </div>
        </div>

        <h1 className="login-title">{mode === 'register' ? 'Hazte afiliado' : 'Acceso de afiliado'}</h1>
        <p className="login-subtitle">
          {mode === 'register'
            ? 'Recomienda Alarfly con tu propio enlace y gana una comisión por cada empresa que se registre.'
            : 'Ingresa con el correo y contraseña de tu cuenta de afiliado.'}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="login-field">
              <span>Tu nombre</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" required />
            </label>
          )}

          <label className="login-field">
            <span>Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@ejemplo.com"
              autoComplete="username"
              required
            />
          </label>

          {mode === 'register' && (
            <label className="login-field">
              <span>Teléfono (opcional)</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 ..." />
            </label>
          )}

          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Un momento…' : mode === 'register' ? 'Crear mi cuenta de afiliado' : 'Ingresar'}
          </button>
        </form>

        <p className="login-subtitle" style={{ marginTop: 16 }}>
          {mode === 'register' ? (
            <>
              ¿Ya tienes cuenta de afiliado?{' '}
              <button type="button" className="login-link-button" onClick={() => setMode('login')}>
                Inicia sesión
              </button>
            </>
          ) : (
            <>
              ¿Todavía no eres afiliado?{' '}
              <button type="button" className="login-link-button" onClick={() => setMode('register')}>
                Regístrate
              </button>
            </>
          )}
        </p>
        <p className="login-subtitle" style={{ marginTop: 8 }}>
          <Link to="/">Volver a Alarfly</Link>
        </p>
      </div>
    </div>
  );
}
