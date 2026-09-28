const requestId = require('./requestId');

describe('requestId', () => {
  test('asigna un id único a req y lo expone en el header X-Request-Id', () => {
    const req = {};
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.id).toEqual(expect.any(String));
    expect(req.id.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('dos peticiones distintas reciben ids distintos', () => {
    const req1 = {};
    const req2 = {};
    requestId(req1, { setHeader: jest.fn() }, jest.fn());
    requestId(req2, { setHeader: jest.fn() }, jest.fn());

    expect(req1.id).not.toBe(req2.id);
  });
});
