// Verifica la matriz de permisos fina aprobada para Análisis Avanzados:
// - Puerta del módulo: ADMIN/ACCOUNTANT/FINANCE entran, COLLABORATOR no.
// - Ejecutar análisis manual / configurar automatización: solo ADMIN/FINANCE
//   (Contador queda en modo lectura).
// - Editar valores de benchmarking: solo ADMIN.
const { requireRole } = require('../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../core/rbac/rbac.middleware');

function mockReqRes(role) {
  return { req: { auth: role ? { role } : undefined }, res: {}, next: jest.fn() };
}

function passes(middleware, role) {
  const { req, res, next } = mockReqRes(role);
  try {
    middleware(req, res, next);
  } catch {
    return false;
  }
  return next.mock.calls.length === 1;
}

describe('Análisis Avanzados — puerta del módulo', () => {
  const moduleGate = requireModuleAccess('advanced-analytics');

  test.each(['ADMIN', 'ACCOUNTANT', 'FINANCE'])('%s entra al módulo', (role) => {
    expect(passes(moduleGate, role)).toBe(true);
  });

  test('COLLABORATOR no entra al módulo', () => {
    expect(passes(moduleGate, 'COLLABORATOR')).toBe(false);
  });
});

describe('Análisis Avanzados — ejecutar/configurar (solo ADMIN/FINANCE)', () => {
  const canRunAndConfigure = requireRole('ADMIN', 'FINANCE');

  test.each(['ADMIN', 'FINANCE'])('%s puede ejecutar y configurar', (role) => {
    expect(passes(canRunAndConfigure, role)).toBe(true);
  });

  test('ACCOUNTANT (Contador) queda en modo lectura: no puede ejecutar ni configurar', () => {
    expect(passes(canRunAndConfigure, 'ACCOUNTANT')).toBe(false);
  });
});

describe('Análisis Avanzados — editar benchmarking (solo ADMIN)', () => {
  const canEditBenchmarks = requireRole('ADMIN');

  test('ADMIN puede editar valores de referencia de industria', () => {
    expect(passes(canEditBenchmarks, 'ADMIN')).toBe(true);
  });

  test.each(['FINANCE', 'ACCOUNTANT'])('%s no puede editar valores de referencia de industria', (role) => {
    expect(passes(canEditBenchmarks, role)).toBe(false);
  });
});
