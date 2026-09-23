const { Prisma } = require('@prisma/client');
const { buildFiscalTransactionLines } = require('./fiscal-transactions.rules');

const { Decimal } = Prisma;

function sumDebits(lines) {
  return lines.reduce((sum, line) => sum.plus(line.debit), new Decimal(0));
}
function sumCredits(lines) {
  return lines.reduce((sum, line) => sum.plus(line.credit), new Decimal(0));
}

describe('buildFiscalTransactionLines (venta)', () => {
  test('venta simple sin retención queda balanceada', () => {
    const lines = buildFiscalTransactionLines({
      type: 'SALE',
      taxBase: 1000,
      taxAmount: 190,
      withholdingAmount: 0,
      taxBaseAccountId: 'revenue',
      counterpartyAccountId: 'ar',
      taxAccountId: 'vat-payable',
    });
    expect(sumDebits(lines).toNumber()).toBe(1190);
    expect(sumCredits(lines).toNumber()).toBe(1190);
    expect(lines.find((l) => l.accountId === 'ar').debit.toNumber()).toBe(1190);
    expect(lines.find((l) => l.accountId === 'revenue').credit.toNumber()).toBe(1000);
    expect(lines.find((l) => l.accountId === 'vat-payable').credit.toNumber()).toBe(190);
  });

  test('venta con retención: la contraparte debe menos, y la retención queda como débito aparte', () => {
    const lines = buildFiscalTransactionLines({
      type: 'SALE',
      taxBase: 1000,
      taxAmount: 190,
      withholdingAmount: 25,
      taxBaseAccountId: 'revenue',
      counterpartyAccountId: 'ar',
      taxAccountId: 'vat-payable',
      withholdingAccountId: 'withholding-asset',
    });
    expect(sumDebits(lines).toNumber()).toBe(1190);
    expect(sumCredits(lines).toNumber()).toBe(1190);
    expect(lines.find((l) => l.accountId === 'ar').debit.toNumber()).toBe(1165);
    expect(lines.find((l) => l.accountId === 'withholding-asset').debit.toNumber()).toBe(25);
  });

  test('rechaza si hay impuesto pero no se indica la cuenta', () => {
    expect(() =>
      buildFiscalTransactionLines({
        type: 'SALE',
        taxBase: 1000,
        taxAmount: 190,
        withholdingAmount: 0,
        taxBaseAccountId: 'revenue',
        counterpartyAccountId: 'ar',
      })
    ).toThrow('taxAccountId');
  });
});

describe('buildFiscalTransactionLines (compra)', () => {
  test('compra simple con retención queda balanceada', () => {
    const lines = buildFiscalTransactionLines({
      type: 'PURCHASE',
      taxBase: 2000,
      taxAmount: 380,
      withholdingAmount: 50,
      taxBaseAccountId: 'expense',
      counterpartyAccountId: 'ap',
      taxAccountId: 'vat-deductible',
      withholdingAccountId: 'withholding-payable',
    });
    expect(sumDebits(lines).toNumber()).toBe(2380);
    expect(sumCredits(lines).toNumber()).toBe(2380);
    expect(lines.find((l) => l.accountId === 'expense').debit.toNumber()).toBe(2000);
    expect(lines.find((l) => l.accountId === 'ap').credit.toNumber()).toBe(2330);
    expect(lines.find((l) => l.accountId === 'withholding-payable').credit.toNumber()).toBe(50);
  });
});
