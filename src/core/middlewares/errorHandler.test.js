// Fase 2 (maestros): antes de esto, una violación de restricción única
// (P2002 — ej. crear un cliente/proveedor/producto/categoría/unidad de
// medida con un valor duplicado) caía en el manejador genérico de 500
// ("error inesperado"), sin ninguna traducción. Ahora responde 409 con
// un mensaje claro, igual que ya hacía P2003 para datos relacionados.
const errorHandler = require('./errorHandler');
const AppError = require('../utils/AppError');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  test('AppError responde con su propio código y mensaje', () => {
    const res = mockRes();
    errorHandler(new AppError('mensaje claro', 404, 'NOT_FOUND'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'mensaje claro', code: 'NOT_FOUND' } });
  });

  test('P2002 (restricción única) responde 409 con un mensaje claro, no el error crudo de Prisma', () => {
    const res = mockRes();
    const prismaError = new Error("Unique constraint failed on the fields: (`companyId`,`sku`)");
    prismaError.code = 'P2002';

    errorHandler(prismaError, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('DUPLICATE_VALUE');
    expect(payload.error.message).not.toMatch(/prisma|constraint/i);
  });

  test('P2003 (dato relacionado) sigue respondiendo 409 como antes', () => {
    const res = mockRes();
    const prismaError = new Error('Foreign key constraint failed');
    prismaError.code = 'P2003';

    errorHandler(prismaError, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error.code).toBe('RELATED_DATA_EXISTS');
  });

  test('un error inesperado sigue respondiendo 500 sin filtrar detalles internos', () => {
    const res = mockRes();
     
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new TypeError('boom'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
    spy.mockRestore();
  });
});
