import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/theme.css'
import './styles/module.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { AffiliateAuthProvider } from './context/AffiliateAuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { CurrencyProvider } from './context/CurrencyContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import { PinnedItemsProvider } from './context/PinnedItemsContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { IncognitoProvider } from './context/IncognitoContext.jsx'
import { IconLabelProvider } from './context/IconLabelContext.jsx'

// Mi Cuenta (frontend/src/core/account) es el primer rincón de la app
// que usa TanStack Query, a pedido explícito del usuario — el resto
// del frontend sigue con fetch + useState/useEffect tal como está, sin
// migrar nada existente.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
        <AffiliateAuthProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <ConfirmProvider>
                <ToastProvider>
                  <PinnedItemsProvider>
                    <IncognitoProvider>
                      <IconLabelProvider>
                        <App />
                      </IconLabelProvider>
                    </IncognitoProvider>
                  </PinnedItemsProvider>
                </ToastProvider>
              </ConfirmProvider>
            </CurrencyProvider>
          </ThemeProvider>
        </AffiliateAuthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
