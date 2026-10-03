import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import './LoginPage.css';

// Fase Landing — Registro Público: primera puerta de entrada real sin
// invitación previa. Mismo patrón visual que LoginPage/AcceptInvitationPage
// (misma tarjeta, mismos estilos) para que no se sienta como una
// pantalla aparte del resto del producto.
export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signup(companyName, name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor.');
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
            <p className="login-brand-tagline">Gestión financiera integral</p>
          </div>
        </div>

        <h1 className="login-title">Crea tu empresa</h1>
        <p className="login-subtitle">
          7 días de prueba gratis. Sin tarjeta, sin letra pequeña.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Nombre de tu empresa</span>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Mi Negocio, C.A."
              autoComplete="organization"
              required
            />
          </label>

          <label className="login-field">
            <span>Tu nombre</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido"
              autoComplete="name"
              required
            />
          </label>

          <label className="login-field">
            <span>Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@empresa.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Al menos 8 caracteres, con mayúscula y número"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creando tu empresa…' : 'Empezar prueba gratis'}
          </button>
        </form>

        <p className="login-subtitle" style={{ marginTop: 16 }}>
          ¿Ya tienes cuenta? <Link to="/acceso">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
