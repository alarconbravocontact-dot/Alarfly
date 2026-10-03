const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');

const COOLDOWN_MS = 60 * 1000; // 1 envío por IP por minuto — ritmo humano normal, sin bloquear a nadie real.

// Protección básica contra spam sin ningún servicio externo: un
// honeypot (ver validator) más una ventana de enfriamiento simple por
// IP, leída de los propios mensajes ya guardados — no hace falta una
// tabla ni una dependencia nueva solo para esto.
async function assertNotRateLimited(ipAddress) {
  if (!ipAddress) return;
  const last = await prisma.contactMessage.findFirst({
    where: { ipAddress },
    orderBy: { createdAt: 'desc' },
  });
  if (last && Date.now() - last.createdAt.getTime() < COOLDOWN_MS) {
    throw new AppError('Ya enviaste un mensaje hace un momento. Espera un minuto antes de enviar otro.', 429, 'CONTACT_RATE_LIMITED');
  }
}

async function createContactMessage({ name, email, subject, message, honeypot }, ipAddress) {
  // Un honeypot lleno nunca es un error de validación visible al
  // usuario real (lo confundiría) — se responde éxito igual, pero no
  // se guarda nada. Mismo criterio que usan sistemas de contacto
  // reales para no delatarle al bot que fue detectado.
  if (honeypot) {
    return null;
  }

  await assertNotRateLimited(ipAddress);

  return prisma.contactMessage.create({
    data: { name, email, subject, message, ipAddress: ipAddress || null },
  });
}

module.exports = { createContactMessage };
