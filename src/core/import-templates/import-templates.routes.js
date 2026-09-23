const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { listTemplatesQuerySchema, createTemplateSchema } = require('./import-templates.validator');
const controller = require('./import-templates.controller');

const router = Router();

// Sin gate de módulo, mismo criterio que core/saved-views: guardar un
// mapeo de columnas no expone ningún dato de negocio por sí solo.
router.use(requireAuth);

router.get('/', validate(listTemplatesQuerySchema, 'query'), controller.listTemplates);
router.post('/', validate(createTemplateSchema), controller.createTemplate);
router.delete('/:id', controller.deleteTemplate);

module.exports = router;
