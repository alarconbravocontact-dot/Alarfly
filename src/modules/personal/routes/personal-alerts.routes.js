const { Router } = require('express');
const controller = require('../controllers/personal-alerts.controller');

const router = Router();

router.post('/scan', controller.scan);

module.exports = router;
