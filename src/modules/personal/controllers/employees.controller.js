const asyncHandler = require('../../../core/utils/asyncHandler');
const employeesService = require('../services/employees.service');
const fichaService = require('../services/employee-ficha.service');

const create = asyncHandler(async (req, res) => {
  const employee = await employeesService.createEmployee(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(employee);
});

const update = asyncHandler(async (req, res) => {
  const employee = await employeesService.updateEmployee(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(employee);
});

const list = asyncHandler(async (req, res) => {
  const employees = await employeesService.listEmployees(req.auth.companyId, req.query);
  res.json(employees);
});

const getOne = asyncHandler(async (req, res) => {
  const employee = await employeesService.getEmployee(req.auth.companyId, req.params.id);
  res.json(employee);
});

const getFicha = asyncHandler(async (req, res) => {
  const ficha = await fichaService.getFicha(req.auth.companyId, req.params.id);
  res.json(ficha);
});

module.exports = { create, update, list, getOne, getFicha };
