const { z } = require('zod');
const { ROLES, DELEGATABLE_PERMISSIONS } = require('../../../core/rbac/roles');

const roleEnum = z.enum(ROLES);

const inviteUserSchema = z.object({
  email: z.string().email('Escribe un correo válido.'),
  name: z.string().min(1, 'El nombre es obligatorio.'),
  role: roleEnum,
});

const changeRoleSchema = z.object({
  role: roleEnum,
});

const permissionKeyEnum = z.enum(Object.values(DELEGATABLE_PERMISSIONS));

const delegatedPermissionSchema = z.object({
  permissionKey: permissionKeyEnum,
});

module.exports = { inviteUserSchema, changeRoleSchema, delegatedPermissionSchema };
