const { z } = require('zod');

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'El nombre es obligatorio.'),
  lastName: z.string().min(1, 'El apellido es obligatorio.'),
  documentId: z.string().optional(),
  email: z.string().email('El correo no es válido.').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  position: z.string().min(1, 'El cargo es obligatorio.'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'OTHER']).optional(),
  hireDate: z.coerce.date(),
  branchDimensionId: z.string().optional(),
  fpaDimensionId: z.string().optional(),
  supervisorId: z.string().optional(),
  baseSalary: z.coerce.number().nonnegative('El salario base no puede ser negativo.'),
  currency: z.string().min(1, 'La moneda es obligatoria.'),
  payFrequency: z.enum(['MONTHLY', 'BIWEEKLY', 'WEEKLY']).optional(),
  paymentMethodNote: z.string().optional(),
  userId: z.string().optional(),
});

const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const listEmployeesQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  branchDimensionId: z.string().optional(),
  fpaDimensionId: z.string().optional(),
  search: z.string().optional(),
});

module.exports = { createEmployeeSchema, updateEmployeeSchema, listEmployeesQuerySchema };
