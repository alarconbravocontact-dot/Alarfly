import { Navigate, Outlet } from 'react-router-dom';
import { useAffiliateAuth } from '../context/AffiliateAuthContext';

// Espejo de ProtectedRoute.jsx, pero para la sesión de afiliado — nunca
// comparte lógica con la de empresa (son dos actores distintos, ver
// AffiliateAuthContext).
export default function AffiliateProtectedRoute() {
  const { isAffiliateAuthenticated } = useAffiliateAuth();
  if (!isAffiliateAuthenticated) {
    return <Navigate to="/afiliados" replace />;
  }
  return <Outlet />;
}
