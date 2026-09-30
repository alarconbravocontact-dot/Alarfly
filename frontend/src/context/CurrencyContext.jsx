import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { accountApi } from '../api/account';
import { fxApi } from '../api/fx';
import { useAuth } from './AuthContext';

const CurrencyContext = createContext(null);

function cacheKey(userId) {
  return `display-currency-cache-${userId}`;
}

// La preferencia real vive en el servidor (UserPreference.displayCurrency,
// ya existía guardándose desde Mi Cuenta > Preferencias pero nunca se
// usaba para convertir nada en pantalla — este contexto es lo que la
// vuelve real). `null`/vacío significa "sin conversión, moneda base de
// la empresa". Mismo patrón de caché de lectura rápida que ThemeContext:
// localStorage solo evita el parpadeo mientras carga la respuesta real
// del servidor, nunca es la fuente de verdad.
export function CurrencyProvider({ children }) {
  const { user } = useAuth();
  const [baseCurrency, setBaseCurrency] = useState('USD');
  // F17-E1: un usuario nuevo nunca veía en ningún lugar de la
  // navegación principal a qué empresa pertenecían los datos que
  // estaba mirando (solo aparecía escondido en Mi Cuenta >
  // Preferencias) — reutiliza la misma llamada que este contexto ya
  // hacía para la moneda base, sin pedir nada nuevo al servidor.
  const [companyName, setCompanyName] = useState('');
  const [displayCurrency, setDisplayCurrencyState] = useState('');
  const [rates, setRates] = useState([]);

  useEffect(() => {
    if (!user) {
      setDisplayCurrencyState('');
      setRates([]);
      setCompanyName('');
      return;
    }
    const cached = localStorage.getItem(cacheKey(user.id));
    if (cached) setDisplayCurrencyState(cached);

    accountApi
      .getCompanyProfile()
      .then((company) => {
        setBaseCurrency(company.baseCurrency || 'USD');
        setCompanyName(company.name || '');
      })
      .catch(() => {});

    accountApi
      .getPreferences()
      .then((prefs) => {
        const currency = prefs?.displayCurrency || '';
        setDisplayCurrencyState(currency);
        localStorage.setItem(cacheKey(user.id), currency);
      })
      .catch(() => {});

    fxApi
      .getLatestRates()
      .then((data) => setRates(data || []))
      .catch(() => setRates([]));
  }, [user]);

  const setDisplayCurrency = useCallback(
    async (newCurrency) => {
      const normalized = newCurrency || '';
      setDisplayCurrencyState(normalized);
      if (user) localStorage.setItem(cacheKey(user.id), normalized);
      await accountApi.updatePreferences({ displayCurrency: normalized || null });
    },
    [user]
  );

  // Convierte un monto en la moneda BASE de la empresa a la moneda de
  // visualización elegida, usando la tasa más reciente registrada
  // (`ExchangeRate.rate` = cuántas unidades de moneda base equivalen a
  // 1 unidad de esa moneda extranjera — misma convención que ya usa
  // `core/fx.revalueAccount`, no se inventó una segunda). Si no hay
  // moneda de visualización elegida, o coincide con la base, o no hay
  // tasa registrada para ella, devuelve el monto original sin convertir
  // — nunca inventa una tasa.
  const convert = useCallback(
    (amount) => {
      const numericAmount = Number(amount);
      if (!displayCurrency || displayCurrency === baseCurrency || Number.isNaN(numericAmount)) {
        return { amount: numericAmount, currency: baseCurrency, isConverted: false, rate: null };
      }
      const rateEntry = rates.find((r) => r.currency === displayCurrency);
      if (!rateEntry) {
        return { amount: numericAmount, currency: baseCurrency, isConverted: false, rate: null };
      }
      const rate = Number(rateEntry.rate);
      return {
        amount: numericAmount / rate,
        currency: displayCurrency,
        isConverted: true,
        rate,
        originalAmount: numericAmount,
        originalCurrency: baseCurrency,
      };
    },
    [displayCurrency, baseCurrency, rates]
  );

  const availableCurrencies = useMemo(() => {
    const codes = new Set(rates.map((r) => r.currency));
    codes.add(baseCurrency);
    return Array.from(codes).sort();
  }, [rates, baseCurrency]);

  const value = useMemo(
    () => ({ baseCurrency, companyName, displayCurrency, setDisplayCurrency, availableCurrencies, convert }),
    [baseCurrency, companyName, displayCurrency, setDisplayCurrency, availableCurrencies, convert]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency debe usarse dentro de <CurrencyProvider>.');
  }
  return context;
}
