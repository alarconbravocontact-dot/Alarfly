const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { parseFileSchema } = require('./import.validator');
const controller = require('./import.controller');

const router = Router();

// Sin gate de módulo a propósito: parsear un archivo a filas de texto
// genéricas no expone ningún dato de negocio por sí solo — quien vaya
// a usar esas filas para crear algo real (ej. un cliente) pasa por la
// puerta de ESE módulo al confirmar la importación, no acá.
router.use(requireAuth);

router.post('/parse', validate(parseFileSchema), controller.parseFile);

module.exports = router;
