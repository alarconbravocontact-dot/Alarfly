const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createJurisdictionSchema,
  createTaxRateSchema,
  closeTaxRateSchema,
  listTaxRatesQuerySchema,
  resolveTaxQuerySchema,
} = require('../validators/tax-rates.validator');
const controller = require('../controllers/tax-rates.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/jurisdictions', controller.listJurisdictions);
router.post('/jurisdictions', canManage, validate(createJurisdictionSchema), controller.createJurisdiction);

router.get('/rates', validate(listTaxRatesQuerySchema, 'query'), controller.listTaxRates);
router.post('/rates', canManage, validate(createTaxRateSchema), controller.createTaxRate);
router.post('/rates/:id/close', canManage, validate(closeTaxRateSchema), controller.closeTaxRate);

router.get('/resolve', validate(resolveTaxQuerySchema, 'query'), controller.resolveTax);

module.exports = router;
