const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const employeesRoutes = require('./employees.routes');
const payrollRoutes = require('./payroll.routes');
const employeeExpensesRoutes = require('./employee-expenses.routes');
const personalSettingsRoutes = require('./personal-settings.routes');
const personalDashboardRoutes = require('./personal-dashboard.routes');
const personalAlertsRoutes = require('./personal-alerts.routes');
const treasuryAccountsController = require('../controllers/treasury-accounts.controller');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('personal'));
router.use('/employees', employeesRoutes);
router.use('/payroll', payrollRoutes);
router.use('/expenses', employeeExpensesRoutes);
router.use('/settings', personalSettingsRoutes);
router.use('/dashboard', personalDashboardRoutes);
router.use('/alerts', personalAlertsRoutes);
// Ver "treasury-accounts.controller.js" — por qué este pase de solo
// lectura vive acá, gateado por Personal, en vez de pedirle al usuario
// que entre a Tesorería (que Financiero no puede).
router.get('/treasury-accounts', treasuryAccountsController.list);

module.exports = router;
