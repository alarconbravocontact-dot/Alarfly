const { applyCreditNoteToInvoice } = require('./ar-credit-notes.rules');

describe('applyCreditNoteToInvoice', () => {
  const invoice = { totalAmount: '1000.00', paidAmount: '400.00' };

  test('una nota de crédito reduce el total de la factura', () => {
    const result = applyCreditNoteToInvoice('CREDIT', 200, invoice);
    expect(result.newTotalAmount.toNumber()).toBe(800);
    expect(result.newStatus).toBe('PARTIALLY_PAID');
  });

  test('una nota de crédito puede dejar la factura como pagada si el total baja hasta lo ya cobrado', () => {
    const result = applyCreditNoteToInvoice('CREDIT', 600, invoice);
    expect(result.newTotalAmount.toNumber()).toBe(400);
    expect(result.newStatus).toBe('PAID');
  });

  test('una nota de débito aumenta el total de la factura', () => {
    const result = applyCreditNoteToInvoice('DEBIT', 150, invoice);
    expect(result.newTotalAmount.toNumber()).toBe(1150);
    expect(result.newStatus).toBe('PARTIALLY_PAID');
  });

  test('rechaza una nota de crédito mayor al total de la factura', () => {
    expect(() => applyCreditNoteToInvoice('CREDIT', 1500, invoice)).toThrow('supera el total de la factura');
  });

  test('rechaza un monto en cero', () => {
    expect(() => applyCreditNoteToInvoice('CREDIT', 0, invoice)).toThrow('debe ser mayor a cero');
  });

  test('rechaza un monto negativo', () => {
    expect(() => applyCreditNoteToInvoice('CREDIT', -50, invoice)).toThrow('debe ser mayor a cero');
  });
});
