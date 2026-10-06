const { Router } = require('express');
const controller = require('../controllers/personal-dashboard.controller');

const router = Router();

router.get('/', controller.getDashboard);

module.exports = router;
