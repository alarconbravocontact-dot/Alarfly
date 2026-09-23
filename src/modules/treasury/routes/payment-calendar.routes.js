const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { paymentCalendarQuerySchema } = require('../validators/payment-calendar.validator');
const controller = require('../controllers/payment-calendar.controller');

const router = Router();

router.get('/', validate(paymentCalendarQuerySchema, 'query'), controller.getCalendar);

module.exports = router;
