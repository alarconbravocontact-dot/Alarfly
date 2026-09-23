const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { listLotsQuerySchema } = require('../validators/lot-traceability.validator');
const controller = require('../controllers/lot-traceability.controller');

const router = Router();

router.get('/', validate(listLotsQuerySchema, 'query'), controller.list);
router.get('/:id/trace', controller.getTrace);

module.exports = router;
