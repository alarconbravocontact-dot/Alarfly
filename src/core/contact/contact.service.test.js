jest.mock('../database/prisma', () => ({
  contactMessage: { create: jest.fn(), findFirst: jest.fn() },
}));

const prisma = require('../database/prisma');
const contactService = require('./contact.service');

describe('contact.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('crea el mensaje real cuando el honeypot viene vacío', async () => {
    prisma.contactMessage.findFirst.mockResolvedValue(null);
    prisma.contactMessage.create.mockResolvedValue({ id: 'm1' });

    const result = await contactService.createContactMessage(
      { name: 'Ana', email: 'ana@example.com', subject: 'Hola', message: 'Un mensaje real suficientemente largo.' },
      '1.2.3.4'
    );

    expect(result).toEqual({ id: 'm1' });
    expect(prisma.contactMessage.create).toHaveBeenCalledWith({
      data: {
        name: 'Ana',
        email: 'ana@example.com',
        subject: 'Hola',
        message: 'Un mensaje real suficientemente largo.',
        ipAddress: '1.2.3.4',
      },
    });
  });

  test('un honeypot lleno descarta el mensaje en silencio — nunca lo guarda ni lanza error', async () => {
    const result = await contactService.createContactMessage(
      { name: 'Bot', email: 'bot@example.com', subject: 'spam', message: 'mensaje de spam', honeypot: 'relleno-por-un-bot' },
      '1.2.3.4'
    );

    expect(result).toBeNull();
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
    expect(prisma.contactMessage.findFirst).not.toHaveBeenCalled();
  });

  test('rechaza un segundo envío desde la misma IP antes de que pase la ventana de enfriamiento', async () => {
    prisma.contactMessage.findFirst.mockResolvedValue({ createdAt: new Date() });

    await expect(
      contactService.createContactMessage(
        { name: 'Ana', email: 'ana@example.com', subject: 'Hola de nuevo', message: 'Otro mensaje real suficientemente largo.' },
        '1.2.3.4'
      )
    ).rejects.toMatchObject({ code: 'CONTACT_RATE_LIMITED' });

    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  test('permite un envío nuevo desde la misma IP una vez pasada la ventana de enfriamiento', async () => {
    prisma.contactMessage.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 2 * 60 * 1000) });
    prisma.contactMessage.create.mockResolvedValue({ id: 'm2' });

    const result = await contactService.createContactMessage(
      { name: 'Ana', email: 'ana@example.com', subject: 'Hola de nuevo', message: 'Otro mensaje real suficientemente largo.' },
      '1.2.3.4'
    );

    expect(result).toEqual({ id: 'm2' });
  });

  test('nunca aplica el límite de envíos cuando no hay IP disponible', async () => {
    prisma.contactMessage.create.mockResolvedValue({ id: 'm3' });

    const result = await contactService.createContactMessage(
      { name: 'Ana', email: 'ana@example.com', subject: 'Hola', message: 'Mensaje real suficientemente largo.' },
      undefined
    );

    expect(result).toEqual({ id: 'm3' });
    expect(prisma.contactMessage.findFirst).not.toHaveBeenCalled();
  });
});
