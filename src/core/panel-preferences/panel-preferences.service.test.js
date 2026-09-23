jest.mock('../database/prisma', () => ({
  panelCollapsePreference: { findUnique: jest.fn(), upsert: jest.fn() },
}));

const prisma = require('../database/prisma');
const panelPreferencesService = require('./panel-preferences.service');

describe('panel-preferences.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getPreference devuelve isCollapsed=false por defecto si nunca se guardó nada', async () => {
    prisma.panelCollapsePreference.findUnique.mockResolvedValue(null);
    const result = await panelPreferencesService.getPreference('u1', 'ar-summary');
    expect(prisma.panelCollapsePreference.findUnique).toHaveBeenCalledWith({
      where: { userId_panelKey: { userId: 'u1', panelKey: 'ar-summary' } },
    });
    expect(result).toEqual({ panelKey: 'ar-summary', isCollapsed: false });
  });

  test('getPreference devuelve el valor guardado si existe', async () => {
    prisma.panelCollapsePreference.findUnique.mockResolvedValue({ panelKey: 'ar-summary', isCollapsed: true });
    const result = await panelPreferencesService.getPreference('u1', 'ar-summary');
    expect(result).toEqual({ panelKey: 'ar-summary', isCollapsed: true });
  });

  test('setPreference hace upsert por [userId, panelKey]', async () => {
    prisma.panelCollapsePreference.upsert.mockResolvedValue({ panelKey: 'ar-summary', isCollapsed: true });
    const result = await panelPreferencesService.setPreference('c1', 'u1', 'ar-summary', true);
    expect(prisma.panelCollapsePreference.upsert).toHaveBeenCalledWith({
      where: { userId_panelKey: { userId: 'u1', panelKey: 'ar-summary' } },
      update: { isCollapsed: true },
      create: { companyId: 'c1', userId: 'u1', panelKey: 'ar-summary', isCollapsed: true },
    });
    expect(result).toEqual({ panelKey: 'ar-summary', isCollapsed: true });
  });
});
