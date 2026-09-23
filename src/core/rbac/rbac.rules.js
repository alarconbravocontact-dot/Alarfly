const AppError = require('../utils/AppError');
const { ROLE_QUOTAS, ROLE_LABELS } = require('./roles');

// Función pura: revisa que asignar `role` a un usuario más no supere el
// cupo máximo de ese rol. `activeCount` es cuántos usuarios ACTIVOS ya
// tiene ese rol en la empresa (sin contar al usuario que se está
// moviendo hacia ese rol, si aplica — eso lo resuelve quien llama).
function assertQuotaAvailable(role, activeCount) {
  const quota = ROLE_QUOTAS[role];
  if (quota == null) return; // ADMIN u otro rol sin límite
  if (activeCount >= quota) {
    throw new AppError(
      `El rol ${ROLE_LABELS[role]} ya tiene ${activeCount} de ${quota} cupos ocupados. Libera un cupo (desactivando o cambiando de rol a otro usuario) antes de asignar este rol de nuevo.`,
      400,
      'ROLE_QUOTA_EXCEEDED'
    );
  }
}

module.exports = { assertQuotaAvailable };
