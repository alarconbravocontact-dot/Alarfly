import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AcceptInvitationPage from './pages/AcceptInvitationPage';
import DashboardPage from './pages/DashboardPage';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import FinanzasLayout from './pages/finance/FinanzasLayout';
import ResumenPage from './pages/finance/ResumenPage';
import ContabilidadAvanzadaPage from './pages/finance/ContabilidadAvanzadaPage';
import AccountingLayout from './pages/accounting/AccountingLayout';
import ChartOfAccountsPage from './pages/accounting/ChartOfAccountsPage';
import JournalEntriesPage from './pages/accounting/JournalEntriesPage';
import ReportsPage from './pages/accounting/ReportsPage';
import PeriodsPage from './pages/accounting/PeriodsPage';
import TasasDeCambioPage from './pages/accounting/TasasDeCambioPage';
import TreasuryLayout from './pages/treasury/TreasuryLayout';
import CashPositionPage from './pages/treasury/CashPositionPage';
import ReconciliationPage from './pages/treasury/ReconciliationPage';
import CreditCardsPage from './pages/treasury/CreditCardsPage';
import PaymentOrdersPage from './pages/treasury/PaymentOrdersPage';
import DebtsPage from './pages/treasury/DebtsPage';
import PettyCashPage from './pages/treasury/PettyCashPage';
import AlertsPage from './pages/treasury/AlertsPage';
import LiquidityForecastPage from './pages/treasury/LiquidityForecastPage';
import FpaLayout from './pages/fpa/FpaLayout';
import DimensionsPage from './pages/fpa/DimensionsPage';
import BudgetsPage from './pages/fpa/BudgetsPage';
import VariancePage from './pages/fpa/VariancePage';
import ScenariosPage from './pages/fpa/ScenariosPage';
import KpisPage from './pages/fpa/KpisPage';
import ArApLayout from './pages/ar-ap/ArApLayout';
import CustomersPage from './pages/ar-ap/CustomersPage';
import ArInvoicesPage from './pages/ar-ap/ArInvoicesPage';
import ArPaymentsPage from './pages/ar-ap/ArPaymentsPage';
import ArCreditNotesPage from './pages/ar-ap/ArCreditNotesPage';
import VendorsPage from './pages/ar-ap/VendorsPage';
import ApBillsPage from './pages/ar-ap/ApBillsPage';
import ApPaymentsPage from './pages/ar-ap/ApPaymentsPage';
import ApCreditNotesPage from './pages/ar-ap/ApCreditNotesPage';
import ArApSettingsPage from './pages/ar-ap/ArApSettingsPage';
import SalesLayout from './pages/sales/SalesLayout';
import QuickSalePage from './pages/sales/QuickSalePage';
import SalesOrdersPage from './pages/sales/SalesOrdersPage';
import SalesDeliveriesPage from './pages/sales/SalesDeliveriesPage';
import InventoryLayout from './pages/inventory/InventoryLayout';
import CatalogPage from './pages/inventory/CatalogPage';
import WarehousesPage from './pages/inventory/WarehousesPage';
import StockPage from './pages/inventory/StockPage';
import MovementsPage from './pages/inventory/MovementsPage';
import TransfersPage from './pages/inventory/TransfersPage';
import PhysicalCountsPage from './pages/inventory/PhysicalCountsPage';
import PurchaseOrdersPage from './pages/inventory/PurchaseOrdersPage';
import LotsPage from './pages/inventory/LotsPage';
import FiscalLayout from './pages/fiscal/FiscalLayout';
import TaxRatesPage from './pages/fiscal/TaxRatesPage';
import FiscalTransactionsPage from './pages/fiscal/FiscalTransactionsPage';
import RiskRulesPage from './pages/fiscal/RiskRulesPage';
import FiscalBooksPage from './pages/fiscal/FiscalBooksPage';
import ElectronicInvoicingPage from './pages/fiscal/ElectronicInvoicingPage';
import FiscalObligationsPage from './pages/fiscal/FiscalObligationsPage';
import FiscalDocumentsPage from './pages/fiscal/FiscalDocumentsPage';
import ReportsLayout from './pages/reports/ReportsLayout';
import FinancialStatementsPage from './pages/reports/FinancialStatementsPage';
import TransactionsByTypePage from './pages/reports/TransactionsByTypePage';
import CashFlowPage from './pages/reports/CashFlowPage';
import ProfitabilityPage from './pages/reports/ProfitabilityPage';
import AgingPage from './pages/reports/AgingPage';
import ConsolidationPage from './pages/reports/ConsolidationPage';
import ExecutiveDashboardPage from './pages/reports/ExecutiveDashboardPage';
import ExportPage from './pages/reports/ExportPage';
import MetricsPage from './pages/metrics/MetricsPage';
import NivelesAccesoPage from './modules/niveles-acceso/NivelesAccesoPage';
import AuditTrailPage from './pages/audit/AuditTrailPage';
import AdvancedAnalyticsLayout from './modules/analisis-avanzados/AdvancedAnalyticsLayout';
import AnalysisCatalogPage from './modules/analisis-avanzados/CatalogPage';
import AnalysisReportsArchivePage from './modules/analisis-avanzados/ReportsArchivePage';
import BenchmarkingPage from './modules/analisis-avanzados/BenchmarkingPage';
import AccountLayout from './core/account/AccountLayout';
import ProfileSection from './core/account/ProfileSection';
import SecuritySection from './core/account/SecuritySection';
import RoleSection from './core/account/RoleSection';
import PreferencesSection from './core/account/PreferencesSection';
import NotificationsSection from './core/account/NotificationsSection';
import ActivitySection from './core/account/ActivitySection';
import SignatureSection from './core/account/SignatureSection';
import DangerZoneSection from './core/account/DangerZoneSection';

function App() {
  return (
    <Routes>
      <Route path="/acceso" element={<LoginPage />} />
      <Route path="/registro" element={<SignupPage />} />
      <Route path="/aceptar-invitacion" element={<AcceptInvitationPage />} />

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
            <Route path="periodos" element={<PeriodsPage />} />
            <Route path="tasas-de-cambio" element={<TasasDeCambioPage />} />
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
