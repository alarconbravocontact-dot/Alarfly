import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { captureReferralFromUrl } from './utils/referralCapture';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AffiliateAccessPage from './pages/affiliates/AffiliateAccessPage';
import AffiliateLayout from './pages/affiliates/AffiliateLayout';
import AffiliateProtectedRoute from './components/AffiliateProtectedRoute';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage';
import TermsPage from './pages/legal/TermsPage';
import ContactPage from './pages/legal/ContactPage';
import NotFoundPage from './pages/NotFoundPage';

// Cierre Web/SEO (rendimiento, sección 14): todo lo de acá para abajo
// solo lo necesita un usuario YA autenticado (el ERP completo) — antes
// se importaba todo de forma estática en este mismo archivo, así que
// un visitante nuevo que solo quería ver la Landing pública descargaba
// el bundle ENTERO de la aplicación (1.36 MB sin comprimir, medido
// antes de este cambio) antes de poder ver una sola palabra. Se migran
// a `React.lazy` — Vite/Rollup las separa en sus propios chunks,
// cargados solo cuando de verdad se navega ahí (al iniciar sesión) —
// sin tocar ninguna lógica de negocio, solo el mecanismo de import.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FinanzasLayout = lazy(() => import('./pages/finance/FinanzasLayout'));
const ResumenPage = lazy(() => import('./pages/finance/ResumenPage'));
const ContabilidadAvanzadaPage = lazy(() => import('./pages/finance/ContabilidadAvanzadaPage'));
const AccountingLayout = lazy(() => import('./pages/accounting/AccountingLayout'));
const ChartOfAccountsPage = lazy(() => import('./pages/accounting/ChartOfAccountsPage'));
const JournalEntriesPage = lazy(() => import('./pages/accounting/JournalEntriesPage'));
const ReportsPage = lazy(() => import('./pages/accounting/ReportsPage'));
const ConfiguracionPage = lazy(() => import('./pages/accounting/ConfiguracionPage'));
const TreasuryLayout = lazy(() => import('./pages/treasury/TreasuryLayout'));
const CashPositionPage = lazy(() => import('./pages/treasury/CashPositionPage'));
const ReconciliationPage = lazy(() => import('./pages/treasury/ReconciliationPage'));
const CreditCardsPage = lazy(() => import('./pages/treasury/CreditCardsPage'));
const PaymentOrdersPage = lazy(() => import('./pages/treasury/PaymentOrdersPage'));
const DebtsPage = lazy(() => import('./pages/treasury/DebtsPage'));
const PettyCashPage = lazy(() => import('./pages/treasury/PettyCashPage'));
const AlertsPage = lazy(() => import('./pages/treasury/AlertsPage'));
const LiquidityForecastPage = lazy(() => import('./pages/treasury/LiquidityForecastPage'));
const FpaLayout = lazy(() => import('./pages/fpa/FpaLayout'));
const DimensionsPage = lazy(() => import('./pages/fpa/DimensionsPage'));
const BudgetsPage = lazy(() => import('./pages/fpa/BudgetsPage'));
const VariancePage = lazy(() => import('./pages/fpa/VariancePage'));
const ScenariosPage = lazy(() => import('./pages/fpa/ScenariosPage'));
const KpisPage = lazy(() => import('./pages/fpa/KpisPage'));
const ArApLayout = lazy(() => import('./pages/ar-ap/ArApLayout'));
const CustomersPage = lazy(() => import('./pages/ar-ap/CustomersPage'));
const ArInvoicesPage = lazy(() => import('./pages/ar-ap/ArInvoicesPage'));
const ArPaymentsPage = lazy(() => import('./pages/ar-ap/ArPaymentsPage'));
const ArCreditNotesPage = lazy(() => import('./pages/ar-ap/ArCreditNotesPage'));
const VendorsPage = lazy(() => import('./pages/ar-ap/VendorsPage'));
const ApBillsPage = lazy(() => import('./pages/ar-ap/ApBillsPage'));
const ApPaymentsPage = lazy(() => import('./pages/ar-ap/ApPaymentsPage'));
const ApCreditNotesPage = lazy(() => import('./pages/ar-ap/ApCreditNotesPage'));
const ArApSettingsPage = lazy(() => import('./pages/ar-ap/ArApSettingsPage'));
const SalesLayout = lazy(() => import('./pages/sales/SalesLayout'));
const QuickSalePage = lazy(() => import('./pages/sales/QuickSalePage'));
const SalesOrdersPage = lazy(() => import('./pages/sales/SalesOrdersPage'));
const SalesDeliveriesPage = lazy(() => import('./pages/sales/SalesDeliveriesPage'));
const InventoryLayout = lazy(() => import('./pages/inventory/InventoryLayout'));
const CatalogPage = lazy(() => import('./pages/inventory/CatalogPage'));
const WarehousesPage = lazy(() => import('./pages/inventory/WarehousesPage'));
const StockPage = lazy(() => import('./pages/inventory/StockPage'));
const MovementsPage = lazy(() => import('./pages/inventory/MovementsPage'));
const TransfersPage = lazy(() => import('./pages/inventory/TransfersPage'));
const PhysicalCountsPage = lazy(() => import('./pages/inventory/PhysicalCountsPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/inventory/PurchaseOrdersPage'));
const LotsPage = lazy(() => import('./pages/inventory/LotsPage'));
const FiscalLayout = lazy(() => import('./pages/fiscal/FiscalLayout'));
const TaxRatesPage = lazy(() => import('./pages/fiscal/TaxRatesPage'));
const FiscalTransactionsPage = lazy(() => import('./pages/fiscal/FiscalTransactionsPage'));
const RiskRulesPage = lazy(() => import('./pages/fiscal/RiskRulesPage'));
const FiscalBooksPage = lazy(() => import('./pages/fiscal/FiscalBooksPage'));
const ElectronicInvoicingPage = lazy(() => import('./pages/fiscal/ElectronicInvoicingPage'));
const FiscalObligationsPage = lazy(() => import('./pages/fiscal/FiscalObligationsPage'));
const FiscalDocumentsPage = lazy(() => import('./pages/fiscal/FiscalDocumentsPage'));
const PersonalLayout = lazy(() => import('./pages/personal/PersonalLayout'));
const PersonalSummaryPage = lazy(() => import('./pages/personal/PersonalSummaryPage'));
const EmployeesPage = lazy(() => import('./pages/personal/EmployeesPage'));
const PayrollPage = lazy(() => import('./pages/personal/PayrollPage'));
const ExpensesPage = lazy(() => import('./pages/personal/ExpensesPage'));
const PersonalSettingsPage = lazy(() => import('./pages/personal/PersonalSettingsPage'));
const ReportsLayout = lazy(() => import('./pages/reports/ReportsLayout'));
const FinancialStatementsPage = lazy(() => import('./pages/reports/FinancialStatementsPage'));
const TransactionsByTypePage = lazy(() => import('./pages/reports/TransactionsByTypePage'));
const CashFlowPage = lazy(() => import('./pages/reports/CashFlowPage'));
const ProfitabilityPage = lazy(() => import('./pages/reports/ProfitabilityPage'));
const AgingPage = lazy(() => import('./pages/reports/AgingPage'));
const ConsolidationPage = lazy(() => import('./pages/reports/ConsolidationPage'));
const ExecutiveDashboardPage = lazy(() => import('./pages/reports/ExecutiveDashboardPage'));
const ExportPage = lazy(() => import('./pages/reports/ExportPage'));
const MetricsPage = lazy(() => import('./pages/metrics/MetricsPage'));
const NivelesAccesoPage = lazy(() => import('./modules/niveles-acceso/NivelesAccesoPage'));
const AuditTrailPage = lazy(() => import('./pages/audit/AuditTrailPage'));
const AdvancedAnalyticsLayout = lazy(() => import('./modules/analisis-avanzados/AdvancedAnalyticsLayout'));
const AnalysisCatalogPage = lazy(() => import('./modules/analisis-avanzados/CatalogPage'));
const AnalysisReportsArchivePage = lazy(() => import('./modules/analisis-avanzados/ReportsArchivePage'));
const BenchmarkingPage = lazy(() => import('./modules/analisis-avanzados/BenchmarkingPage'));
const AffiliateDashboardPage = lazy(() => import('./pages/affiliates/AffiliateDashboardPage'));
const AffiliateAdminPage = lazy(() => import('./pages/affiliates/AffiliateAdminPage'));
const AccountLayout = lazy(() => import('./core/account/AccountLayout'));
const ProfileSection = lazy(() => import('./core/account/ProfileSection'));
const SecuritySection = lazy(() => import('./core/account/SecuritySection'));
const RoleSection = lazy(() => import('./core/account/RoleSection'));
const PreferencesSection = lazy(() => import('./core/account/PreferencesSection'));
const NotificationsSection = lazy(() => import('./core/account/NotificationsSection'));
const ActivitySection = lazy(() => import('./core/account/ActivitySection'));
const SignatureSection = lazy(() => import('./core/account/SignatureSection'));
const DangerZoneSection = lazy(() => import('./core/account/DangerZoneSection'));

function RouteLoadingFallback() {
  return <p className="page-subtitle" style={{ padding: 'var(--space-5)' }}>Cargando…</p>;
}

function App() {
  const location = useLocation();

  // Fase Afiliados: se captura en CADA cambio de ruta (no solo en el
  // montaje inicial de la app) — así funciona sin importar qué pantalla
  // reciba primero el `?ref=` (la Landing, /registro directo, o
  // cualquier otra ruta que alguien comparta con el parámetro). Es
  // idempotente y barata (ver referralCapture.js): si no hay `?ref=`
  // en la URL actual, no hace nada.
  useEffect(() => {
    captureReferralFromUrl(location.search);
  }, [location.search]);

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/acceso" element={<LoginPage />} />
        <Route path="/registro" element={<SignupPage />} />
        <Route path="/aceptar-invitacion" element={<AcceptInvitationPage />} />

        {/* Cierre Web/SEO: públicas, sin sesión y sin AppLayout —
            mismo criterio de ramal independiente que ya usa
            `/afiliados`. */}
        <Route path="/privacidad" element={<PrivacyPolicyPage />} />
        <Route path="/terminos" element={<TermsPage />} />
        <Route path="/contacto" element={<ContactPage />} />

        {/* Fase Afiliados: ramal de rutas totalmente independiente del
            resto de la app — ni ProtectedRoute (sesión de empresa) ni
            AppLayout (menú de 9 módulos) aplican acá, porque un afiliado
            no es un User de ninguna Company (ver backend
            core/affiliates). `/afiliados` es pública (registro/login de
            afiliado); `/afiliados/panel` exige la sesión de afiliado. */}
        <Route path="/afiliados" element={<AffiliateAccessPage />} />
        <Route element={<AffiliateProtectedRoute />}>
          <Route element={<AffiliateLayout />}>
            <Route path="/afiliados/panel" element={<AffiliateDashboardPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/finanzas" element={<FinanzasLayout />}>
              <Route index element={<Navigate to="resumen" replace />} />
              <Route path="resumen" element={<ResumenPage />} />
              <Route path="dinero" element={<CashPositionPage />} />
              <Route path="cobros" element={<ArPaymentsPage />} />
              <Route path="pagos" element={<ApPaymentsPage />} />
              <Route path="cxc" element={<AgingPage initialMode="receivables" />} />
              <Route path="cxp" element={<AgingPage initialMode="payables" />} />
              <Route path="financiamiento" element={<DebtsPage />} />
              <Route path="liquidez" element={<LiquidityForecastPage />} />
              {/* Rediseño UX/UI (Etapa 1, sección 9): mismo componente que
                  /reportes/rentabilidad, montado también acá para que la
                  pestaña "Rentabilidad" de Finanzas se quede dentro de su
                  propio árbol de rutas (breadcrumb y barra de pestañas de
                  Finanzas intactos) en vez de saltar a Reportes. */}
              <Route path="rentabilidad" element={<ProfitabilityPage />} />
              <Route path="contabilidad-avanzada" element={<ContabilidadAvanzadaPage />} />
            </Route>
            <Route path="/contabilidad" element={<AccountingLayout />}>
              <Route index element={<Navigate to="cuentas" replace />} />
              <Route path="cuentas" element={<ChartOfAccountsPage />} />
              <Route path="asientos" element={<JournalEntriesPage />} />
              <Route path="reportes" element={<ReportsPage />} />
              <Route path="configuracion" element={<ConfiguracionPage />} />
            </Route>
            <Route path="/tesoreria" element={<TreasuryLayout />}>
              <Route index element={<Navigate to="cuentas" replace />} />
              <Route path="cuentas" element={<CashPositionPage />} />
              <Route path="conciliacion" element={<ReconciliationPage />} />
              <Route path="tarjetas" element={<CreditCardsPage />} />
              <Route path="pagos" element={<PaymentOrdersPage />} />
              <Route path="deuda" element={<DebtsPage />} />
              <Route path="caja-chica" element={<PettyCashPage />} />
              <Route path="alertas" element={<AlertsPage />} />
              <Route path="liquidez" element={<LiquidityForecastPage />} />
            </Route>
            <Route path="/fpa" element={<FpaLayout />}>
              <Route index element={<Navigate to="dimensiones" replace />} />
              <Route path="dimensiones" element={<DimensionsPage />} />
              <Route path="presupuestos" element={<BudgetsPage />} />
              <Route path="desviaciones" element={<VariancePage />} />
              <Route path="simulador" element={<ScenariosPage />} />
              <Route path="kpis" element={<KpisPage />} />
            </Route>
            <Route path="/cuentas" element={<ArApLayout />}>
              <Route index element={<Navigate to="clientes" replace />} />
              <Route path="clientes" element={<CustomersPage />} />
              <Route path="facturas-venta" element={<ArInvoicesPage />} />
              <Route path="cobros" element={<ArPaymentsPage />} />
              <Route path="notas-credito" element={<ArCreditNotesPage />} />
              <Route path="proveedores" element={<VendorsPage />} />
              <Route path="facturas-compra" element={<ApBillsPage />} />
              <Route path="pagos" element={<ApPaymentsPage />} />
              <Route path="notas-credito-compra" element={<ApCreditNotesPage />} />
              <Route path="ajustes" element={<ArApSettingsPage />} />
            </Route>
            <Route path="/ventas" element={<SalesLayout />}>
              <Route index element={<Navigate to="rapida" replace />} />
              <Route path="rapida" element={<QuickSalePage />} />
              <Route path="pedidos" element={<SalesOrdersPage />} />
              <Route path="entregas" element={<SalesDeliveriesPage />} />
            </Route>
            <Route path="/inventario" element={<InventoryLayout />}>
              <Route index element={<Navigate to="catalogo" replace />} />
              <Route path="catalogo" element={<CatalogPage />} />
              <Route path="almacenes" element={<WarehousesPage />} />
              <Route path="stock" element={<StockPage />} />
              <Route path="movimientos" element={<MovementsPage />} />
              <Route path="transferencias" element={<TransfersPage />} />
              <Route path="conteos" element={<PhysicalCountsPage />} />
              <Route path="compras" element={<PurchaseOrdersPage />} />
              <Route path="lotes" element={<LotsPage />} />
            </Route>
            <Route path="/fiscal" element={<FiscalLayout />}>
              <Route index element={<Navigate to="impuestos" replace />} />
              <Route path="impuestos" element={<TaxRatesPage />} />
              <Route path="transacciones" element={<FiscalTransactionsPage />} />
              <Route path="reglas-de-riesgo" element={<RiskRulesPage />} />
              <Route path="libros" element={<FiscalBooksPage />} />
              <Route path="facturacion-electronica" element={<ElectronicInvoicingPage />} />
              <Route path="calendario" element={<FiscalObligationsPage />} />
              <Route path="documentos" element={<FiscalDocumentsPage />} />
            </Route>
            <Route path="/personal" element={<PersonalLayout />}>
              <Route index element={<Navigate to="resumen" replace />} />
              <Route path="resumen" element={<PersonalSummaryPage />} />
              <Route path="empleados" element={<EmployeesPage />} />
              <Route path="nomina" element={<PayrollPage />} />
              <Route path="gastos" element={<ExpensesPage />} />
              <Route path="ajustes" element={<PersonalSettingsPage />} />
            </Route>
            <Route path="/reportes" element={<ReportsLayout />}>
              <Route index element={<Navigate to="estados-financieros" replace />} />
              <Route path="estados-financieros" element={<FinancialStatementsPage />} />
              <Route path="flujo-de-efectivo" element={<CashFlowPage />} />
              <Route path="rentabilidad" element={<ProfitabilityPage />} />
              <Route path="antiguedad-de-saldos" element={<AgingPage />} />
              <Route path="consolidacion" element={<ConsolidationPage />} />
              <Route path="tablero-ejecutivo" element={<ExecutiveDashboardPage />} />
              <Route path="exportar" element={<ExportPage />} />
            </Route>
            <Route path="/reportes/transacciones" element={<TransactionsByTypePage />} />
            <Route path="/metricas" element={<MetricsPage />} />
            <Route path="/analisis-avanzados" element={<AdvancedAnalyticsLayout />}>
              <Route index element={<Navigate to="catalogo" replace />} />
              <Route path="catalogo" element={<AnalysisCatalogPage />} />
              <Route path="repositorio" element={<AnalysisReportsArchivePage />} />
              <Route path="benchmarking" element={<BenchmarkingPage />} />
            </Route>
            <Route path="/niveles-de-acceso" element={<NivelesAccesoPage />} />
            <Route path="/auditoria" element={<AuditTrailPage />} />
            <Route path="/admin/afiliados" element={<AffiliateAdminPage />} />
            <Route path="/mi-cuenta" element={<AccountLayout />}>
              <Route index element={<Navigate to="perfil" replace />} />
              <Route path="perfil" element={<ProfileSection />} />
              <Route path="seguridad" element={<SecuritySection />} />
              <Route path="rol-y-permisos" element={<RoleSection />} />
              <Route path="preferencias" element={<PreferencesSection />} />
              <Route path="notificaciones" element={<NotificationsSection />} />
              <Route path="actividad" element={<ActivitySection />} />
              <Route path="firma" element={<SignatureSection />} />
              <Route path="zona-de-riesgo" element={<DangerZoneSection />} />
            </Route>
          </Route>
        </Route>

        {/* Cierre Web/SEO: antes, cualquier ruta inexistente
            redirigía en silencio a "/" — nunca existió un estado de
            error real. Ahora muestra una 404 real, marcada noIndex. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
