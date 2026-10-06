const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema } = require('../validators/employees.validator');
const controller = require('../controllers/employees.controller');

const router = Router();

router.get('/', validate(listEmployeesQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/ficha', controller.getFicha);
router.post('/', validate(createEmployeeSchema), controller.create);
router.patch('/:id', validate(updateEmployeeSchema), controller.update);

module.exports = router;
