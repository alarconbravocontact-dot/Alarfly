const { Router } = require('express');
const controller = require('../controllers/executive-summary.controller');

const router = Router();

// De solo lectura, sin restricción de rol adicional: cualquiera que ya
// entró al módulo (gate en routes/index.js) puede ver el resumen —
// mismo criterio que las listas de facturas/clientes.
router.get('/', controller.getSummary);

module.exports = router;
