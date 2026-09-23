const { Router } = require('express');
const { requireAuth } = require('../auth/auth.middleware');
const controller = require('./glossary.controller');

const router = Router();

// Sin gate de módulo: la definición de un término es texto educativo
// general, y el valor en vivo de cada uno ya lo protege su propio
// servicio de origen (ej. EBITDA solo se calcula sobre datos de la
// empresa del usuario autenticado, nunca de otra).
router.use(requireAuth);

router.get('/', controller.listTerms);
router.get('/:key/value', controller.getLiveValue);

module.exports = router;
