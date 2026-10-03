const { Router } = require('express');
const validate = require('../middlewares/validate');
const controller = require('./contact.controller');
const { createContactMessageSchema } = require('./contact.validator');

const router = Router();

// Pública por completo — igual que /affiliates/register, un visitante
// que todavía no tiene cuenta debe poder escribir sin iniciar sesión.
router.post('/', validate(createContactMessageSchema), controller.createContactMessage);

module.exports = router;
