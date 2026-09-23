const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { contextQuerySchema, askQuestionSchema } = require('./help.validator');
const controller = require('./help.controller');

const router = Router();

// Sin gate de módulo a propósito, mismo criterio que /glossary y
// /notifications: la ayuda contextual es transversal — cualquier
// usuario autenticado la necesita sin importar a qué módulos tiene
// acceso su rol.
router.use(requireAuth);

router.get('/context', validate(contextQuerySchema, 'query'), controller.getContext);
router.post('/ask', validate(askQuestionSchema), controller.askQuestion);

module.exports = router;
