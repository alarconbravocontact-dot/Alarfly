import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingPage from '../pages/landing/LandingPage';

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Fase Landing: "/" es la única ruta que, sin sesión, muestra la
    // landing pública en vez de redirigir a /acceso — es la puerta de
    // entrada real para un visitante que nunca usó Alarfly. Cualquier
    // otra ruta protegida (ej. llegar directo a /finanzas sin sesión)
    // sigue redirigiendo al login exactamente como antes, sin cambios.
    if (location.pathname === '/') {
      return <LandingPage />;
    }
    return <Navigate to="/acceso" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
