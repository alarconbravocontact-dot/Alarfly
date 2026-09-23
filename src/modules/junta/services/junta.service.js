// Junta: mensajes cortos con un adjunto que Contador/Financiero/
// Colaborador le mandan al Administrador como reporte de trabajo.
// Contenido del archivo en base64 (mismo criterio que los comprobantes
// de Caja Chica y los documentos de Fiscal).
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

const messageListSelect = {
  id: true,
  message: true,
  topic: true,
  fileName: true,
  fileMimeType: true,
  fileSizeBytes: true,
  isRead: true,
  reviewedAt: true,
  createdAt: true,
  sender: { select: { id: true, name: true, email: true, role: true } },
  reviewedByUser: { select: { id: true, name: true } },
};

async function createMessage(companyId, senderUserId, data) {
  return prisma.juntaMessage.create({
    data: {
      companyId,
      senderUserId,
      message: data.message,
      topic: data.topic,
      fileName: data.fileName,
      fileMimeType: data.fileMimeType,
      fileSizeBytes: data.fileSizeBytes,
      fileContentBase64: data.fileContentBase64,
    },
    select: messageListSelect,
  });
}

// El Administrador ve todos los mensajes de la empresa; cualquier otro
// usuario ve solo los que él mismo envió — nunca los de otro compañero.
async function listMessages(companyId, requestingUser) {
  const isAdmin = requestingUser.role === 'ADMIN';
  return prisma.juntaMessage.findMany({
    where: {
      companyId,
      senderUserId: isAdmin ? undefined : requestingUser.userId,
    },
    select: messageListSelect,
    orderBy: { createdAt: 'desc' },
  });
}

async function countUnread(companyId) {
  return prisma.juntaMessage.count({ where: { companyId, isRead: false } });
}

async function getMessageFile(companyId, id) {
  const message = await prisma.juntaMessage.findFirst({
    where: { id, companyId },
    select: { id: true, fileName: true, fileMimeType: true, fileSizeBytes: true, fileContentBase64: true },
  });
  if (!message) {
    throw new AppError('El mensaje indicado no existe.', 404, 'JUNTA_MESSAGE_NOT_FOUND');
  }
  return message;
}

// Marcar como leído/revisado es una acción del Administrador (a quien
// van dirigidos estos reportes) — se valida por rol, no por rutas
// separadas, mismo criterio que otras acciones "solo Admin" del proyecto.
async function markAsRead(companyId, reviewingUserId, id) {
  const message = await prisma.juntaMessage.findFirst({ where: { id, companyId } });
  if (!message) {
    throw new AppError('El mensaje indicado no existe.', 404, 'JUNTA_MESSAGE_NOT_FOUND');
  }
  if (message.isRead) {
    return message;
  }

  const updated = await prisma.juntaMessage.update({
    where: { id },
    data: { isRead: true, reviewedByUserId: reviewingUserId, reviewedAt: new Date() },
    select: messageListSelect,
  });

  await auditService.log({
    companyId,
    userId: reviewingUserId,
    action: 'junta_message.marked_as_read',
    entityType: 'JuntaMessage',
    entityId: id,
    oldValue: { isRead: false },
    newValue: { isRead: true },
  });

  return updated;
}

module.exports = { createMessage, listMessages, countUnread, getMessageFile, markAsRead };
