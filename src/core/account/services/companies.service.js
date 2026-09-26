// Mi Cuenta, punto 5: a qué empresas tiene acceso el usuario y cuál
// tiene activa ahora mismo. Hoy cada usuario nace con exactamente un
// acceso (su empresa original) — no existe todavía ningún flujo que le
// otorgue una segunda empresa; el selector queda listo para cuando
// exista ese flujo, sin inventarlo acá.
const prisma = require('../../database/prisma');
const AppError = require('../../utils/AppError');
const authService = require('../../auth/auth.service');

async function listMyCompanies(userId) {
  const rows = await prisma.userCompanyAccess.findMany({
    where: { userId },
    select: { companyId: true, isDefault: true, company: { select: { id: true, name: true } } },
    orderBy: { isDefault: 'desc' },
  });
  if (rows.length > 0) return rows;

  // Rediseño UX/UI (Etapa 7) — bug real corregido: `UserCompanyAccess`
  // solo se llenó una vez, a mano, en la migración que la creó
  // (`account_module`) — ningún camino real de creación de usuarios
  // (seed, invitación aceptada) escribe esta tabla, así que cualquier
  // usuario nacido después de esa migración (o cualquier entorno
  // resembrado desde cero) se quedaba sin ninguna fila. Efecto visible:
  // "Empresa activa" en Mi Cuenta > Preferencias mostraba paréntesis
  // vacíos ("Solo tienes acceso a una empresa ()."). Como `User.
  // companyId` es una columna obligatoria (todo usuario SIEMPRE
  // pertenece a una empresa), se deriva acá la fila que falta al leer,
  // en vez de depender de recordar escribir `UserCompanyAccess` en
  // cada camino de creación de usuarios — mismo criterio de "hacer la
  // lectura robusta" ya usado para idioma/formato de fecha/huso
  // horario (`?? valor de la empresa`).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, company: { select: { id: true, name: true } } },
  });
  if (!user) return [];
  return [{ companyId: user.companyId, isDefault: true, company: user.company }];
}

// Reemite el token con la empresa elegida, sin crear una sesión nueva
// (misma sesión, otra empresa activa). El rol del usuario es el mismo
// en cualquier empresa a la que tenga acceso — este modelo de datos no
// tiene un rol distinto por empresa (User.role es un solo valor).
async function switchActiveCompany(userId, sessionId, companyId) {
  const access = await prisma.userCompanyAccess.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Mismo bug de arriba, aplicado acá: sin una fila explícita, un
  // usuario no podía "cambiar" ni siquiera a su propia empresa por
  // defecto (`User.companyId`) — nunca se disparaba desde la interfaz
  // hoy (el selector se oculta con una sola empresa), pero el servicio
  // en sí quedaba roto para ese caso. Se sigue rechazando cualquier
  // empresa que no sea ni un acceso otorgado ni la propia por defecto.
  if (!access && user?.companyId !== companyId) {
    throw new AppError('No tienes acceso a esa empresa.', 403, 'COMPANY_ACCESS_DENIED');
  }

  return authService.buildSession(user, sessionId, companyId);
}

module.exports = { listMyCompanies, switchActiveCompany };
