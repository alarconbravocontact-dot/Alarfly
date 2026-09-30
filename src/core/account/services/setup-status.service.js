// Barra de progreso de configuración inicial (Panel principal). Cada
// paso se marca "hecho" leyendo si la acción real ya ocurrió en el
// sistema — nunca por un botón de "marcar como hecho" — para que el
// usuario nunca pueda mentirle a su propio checklist.
const prisma = require('../../database/prisma');

async function getSetupStatus(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { rif: true, usesInventory: true },
  });

  const [bankAccountCount, productOrClientCount, otherUsersCount] = await Promise.all([
    prisma.treasuryAccount.count({ where: { companyId, type: 'BANK_ACCOUNT' } }),
    company.usesInventory
      ? prisma.product.count({ where: { companyId } })
      : prisma.customer.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId, status: { in: ['ACTIVE', 'INVITED'] } } }),
  ]);

  const steps = [
    {
      key: 'FISCAL_DATA',
      label: 'Completa los datos fiscales de tu empresa',
      description: 'Guarda el RIF o NIT de tu empresa en el Perfil de la Empresa (Mi Cuenta).',
      done: !!(company.rif && company.rif.trim()),
      path: '/mi-cuenta/perfil',
    },
    {
      key: 'BANK_ACCOUNT',
      label: 'Registra tu primera cuenta bancaria',
      description: 'Crea una cuenta bancaria en Tesorería para poder registrar tus movimientos de dinero.',
      done: bankAccountCount > 0,
      path: '/tesoreria/cuentas',
    },
    {
      key: 'PRODUCT_OR_CLIENT',
      label: company.usesInventory ? 'Carga tu primer producto' : 'Registra tu primer cliente',
      description: company.usesInventory
        ? 'Agrega un producto en el catálogo de Inventario.'
        : 'Agrega un cliente en Cuentas por Cobrar.',
      done: productOrClientCount > 0,
      path: company.usesInventory ? '/inventario/catalogo' : '/cuentas/clientes',
    },
    {
      key: 'INVITE_USER',
      label: 'Invita a alguien más de tu equipo',
      description: 'Invita a un segundo usuario desde Niveles de Acceso.',
      // El propio Administrador que crea la empresa ya cuenta como el
      // primer usuario — este paso pide que exista alguien más.
      done: otherUsersCount > 1,
      path: '/niveles-de-acceso',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    allDone: completedCount === steps.length,
  };
}

module.exports = { getSetupStatus };
