const { z } = require('zod');
const { isStrongPassword } = require('../services/security.rules');

// ---- Perfil (punto 1) ----
const updateProfileSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  phone: z.string().optional(),
});

const uploadAvatarSchema = z.object({
  fileName: z.string().min(1, 'El nombre del archivo es obligatorio.'),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp'], {
    errorMap: () => ({ message: 'La foto debe ser PNG, JPG o WEBP.' }),
  }),
  contentBase64: z.string().min(1, 'El contenido de la imagen es obligatorio.'),
});

const updateApprovalSignatureSchema = z.object({
  signature: z.string().max(200, 'La firma es demasiado larga.'),
});

const updateCompanyProfileSchema = z.object({
  name: z.string().min(1, 'El nombre de la empresa es obligatorio.'),
  rif: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  // Barra de progreso de configuración inicial: si el negocio vende
  // productos físicos, determina si el checklist muestra "cargar tu
  // primer producto" o "registrar tu primer cliente" (ver
  // setup-status.service.js).
  usesInventory: z.boolean().optional(),
  // Etiqueta de Estado de Vencimiento (componente DueDateStatus):
  // días antes del vencimiento en que un documento pasa de "al día" a
  // "próximo a vencer". Rango razonable, nunca 0 (perdería el aviso
  // amarillo) ni un número absurdo.
  dueDateWarningThresholdDays: z.number().int().min(1, 'Debe ser al menos 1 día.').max(90, 'Máximo 90 días.').optional(),
  // Selector de rango de fechas con atajos: mes en que arranca el año
  // fiscal del negocio (1 = enero). Usado por el atajo "Año fiscal
  // actual" para no asumir siempre calendario natural.
  fiscalYearStartMonth: z.number().int().min(1, 'Debe ser un mes entre 1 y 12.').max(12, 'Debe ser un mes entre 1 y 12.').optional(),
  // Selector unificado de idioma/huso horario/formato regional: valores
  // por defecto de la empresa (ver preferences.service.js — el ajuste
  // de cada usuario tiene prioridad sobre estos cuando lo configura).
  defaultLanguage: z.enum(['es', 'en']).optional(),
  defaultDateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  defaultTimeZone: z.string().min(1).optional().nullable(),
});

// ---- Empresa activa (punto 5) ----
const switchActiveCompanySchema = z.object({
  companyId: z.string().min(1),
});

// ---- Seguridad (puntos 2, 3) ----
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual.'),
    newPassword: z
      .string()
      .refine(isStrongPassword, 'La contraseña nueva debe tener al menos 8 caracteres, con mayúscula, minúscula y número.'),
    confirmPassword: z.string().min(1, 'Confirma la contraseña nueva.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'La confirmación no coincide con la contraseña nueva.',
    path: ['confirmPassword'],
  });

const twoFactorCodeSchema = z.object({
  code: z.string().min(6, 'El código debe tener 6 dígitos.').max(6, 'El código debe tener 6 dígitos.'),
});

const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Escribe tu contraseña.'),
  code: z.string().min(6, 'El código debe tener 6 dígitos.').max(6, 'El código debe tener 6 dígitos.'),
});

// ---- Preferencias (punto 6) ----
const updatePreferencesSchema = z.object({
  displayCurrency: z.string().length(3).optional().nullable(),
  // Selector unificado de idioma/huso horario/formato regional:
  // `null` explícito significa "usar el valor por defecto de la
  // empresa" (ver preferences.service.js) — por eso los 3 son
  // `.nullable()`, no solo `.optional()`.
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional().nullable(),
  language: z.enum(['es', 'en']).optional().nullable(),
  timeZone: z.string().min(1).optional().nullable(),
  decimalSeparator: z.enum([',', '.']).optional(),
  // "auto" sigue el horario del sistema operativo del usuario (se
  // resuelve en el navegador, el backend solo guarda la preferencia tal
  // cual — ver ThemeContext.jsx).
  theme: z.enum(['dark', 'light', 'auto']).optional(),
  // Modo incógnito global: si está en true, el ícono de ojo se activa
  // solo cuando el navegador detecta que ESTA pestaña se está
  // compartiendo (ver IncognitoContext.jsx) — el estado del modo
  // incógnito en sí nunca se guarda acá.
  autoIncognitoOnScreenShare: z.boolean().optional(),
  // Sistema de iconografía consistente: modo "principiante" — mientras
  // está activo, cada ícono de la app agrega su etiqueta de texto al
  // lado. Empieza en true; el usuario lo apaga una vez que ya reconoce
  // los íconos.
  beginnerIconLabels: z.boolean().optional(),
});

// ---- Notificaciones (punto 9) ----
const updateNotificationPreferenceSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
});

// ---- Actividad (puntos 8, 11) ----
const activityQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const exportActivityQuerySchema = activityQuerySchema.extend({
  format: z.enum(['json', 'csv']).default('json'),
});

// ---- Baja de cuenta (punto 12) ----
const requestDeletionSchema = z.object({
  reason: z.string().max(500).optional(),
});

const decideDeletionSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(500).optional(),
});

module.exports = {
  updateProfileSchema,
  uploadAvatarSchema,
  updateApprovalSignatureSchema,
  updateCompanyProfileSchema,
  switchActiveCompanySchema,
  changePasswordSchema,
  twoFactorCodeSchema,
  disableTwoFactorSchema,
  updatePreferencesSchema,
  updateNotificationPreferenceSchema,
  activityQuerySchema,
  exportActivityQuerySchema,
  requestDeletionSchema,
  decideDeletionSchema,
};
