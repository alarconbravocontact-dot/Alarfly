// Mi Cuenta, sección Perfil (puntos 1 y 10 del pedido): datos
// personales del usuario, foto de perfil, perfil de la empresa y la
// firma de aprobación. El avatar se guarda en base64, mismo criterio
// que Junta/Fiscal/Caja Chica — no hay almacenamiento de archivos real
// todavía en el proyecto.
const prisma = require('../../database/prisma');
const AppError = require('../../utils/AppError');

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarFileName: true,
  avatarMimeType: true,
  role: true,
  approvalSignature: true,
  createdAt: true,
};

async function getProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new AppError('El usuario indicado no existe.', 404, 'USER_NOT_FOUND');
  return user;
}

async function updateProfile(userId, { name, phone }) {
  return prisma.user.update({
    where: { id: userId },
    data: { name, phone },
    select: profileSelect,
  });
}

async function uploadAvatar(userId, { fileName, mimeType, contentBase64 }) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarFileName: fileName, avatarMimeType: mimeType, avatarContentBase64: contentBase64 },
    select: profileSelect,
  });
}

async function getAvatarFile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarFileName: true, avatarMimeType: true, avatarContentBase64: true },
  });
  if (!user || !user.avatarContentBase64) {
    throw new AppError('Este usuario todavía no tiene foto de perfil.', 404, 'AVATAR_NOT_FOUND');
  }
  return user;
}

// Firma de aprobación (punto 10): texto que se registra cuando el
// usuario aprueba un pago o asiento — hoy es solo el dato guardado en
// el perfil; conectarlo a los flujos de aprobación reales (Tesorería,
// Contabilidad) queda documentado como pendiente, no se inventa acá.
async function updateApprovalSignature(userId, signature) {
  return prisma.user.update({
    where: { id: userId },
    data: { approvalSignature: signature },
    select: profileSelect,
  });
}

const companyProfileSelect = {
  id: true,
  name: true,
  taxId: true,
  rif: true,
  website: true,
  address: true,
  postalCode: true,
  baseCurrency: true,
  usesInventory: true,
  dueDateWarningThresholdDays: true,
  fiscalYearStartMonth: true,
  defaultLanguage: true,
  defaultDateFormat: true,
  defaultTimeZone: true,
  // Fase Landing — Registro Público: expuestos de solo lectura (no hay
  // PATCH para estos dos, se fijan una sola vez al registrarse) para
  // que el frontend pueda mostrar el aviso de prueba sin pedir un
  // endpoint nuevo.
  trialStartedAt: true,
  trialEndsAt: true,
};

async function getCompanyProfile(companyId) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: companyProfileSelect });
  if (!company) throw new AppError('La empresa indicada no existe.', 404, 'COMPANY_NOT_FOUND');
  return company;
}

async function updateCompanyProfile(
  companyId,
  {
    name,
    rif,
    website,
    address,
    postalCode,
    usesInventory,
    dueDateWarningThresholdDays,
    fiscalYearStartMonth,
    defaultLanguage,
    defaultDateFormat,
    defaultTimeZone,
  }
) {
  return prisma.company.update({
    where: { id: companyId },
    data: {
      name,
      rif,
      website,
      address,
      postalCode,
      usesInventory,
      dueDateWarningThresholdDays,
      fiscalYearStartMonth,
      defaultLanguage,
      defaultDateFormat,
      defaultTimeZone,
    },
    select: companyProfileSelect,
  });
}

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  getAvatarFile,
  updateApprovalSignature,
  getCompanyProfile,
  updateCompanyProfile,
};
