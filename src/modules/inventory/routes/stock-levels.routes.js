const { Router } = require('express');
const controller = require('../controllers/stock-levels.controller');

const router = Router();

router.get('/', controller.list);
router.get('/lookup', controller.getOne);
router.get('/valuation', controller.valuation);
router.get('/cost', controller.cost);

module.exports = router;
