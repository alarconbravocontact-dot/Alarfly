import { api } from './client';

export const treasuryAccountsApi = {
  cashPosition: (asOfDate) => api.get('/treasury/accounts/cash-position', { asOfDate }),
  list: (query) => api.get('/treasury/accounts', query),
  getOne: (id) => api.get(`/treasury/accounts/${id}`),
  create: (data) => api.post('/treasury/accounts', data),
  update: (id, data) => api.patch(`/treasury/accounts/${id}`, data),
};

export const bankFeedsApi = {
  import: (data) => api.post('/treasury/bank-feeds/import', data),
  listImports: (treasuryAccountId) => api.get('/treasury/bank-feeds/imports', { treasuryAccountId }),
  listTransactions: (query) => api.get('/treasury/bank-feeds/transactions', query),
};

export const reconciliationsApi = {
  list: (treasuryAccountId) => api.get('/treasury/reconciliations', { treasuryAccountId }),
  getOne: (id) => api.get(`/treasury/reconciliations/${id}`),
  exceptions: (treasuryAccountId) => api.get('/treasury/reconciliations/exceptions', { treasuryAccountId }),
  start: (data) => api.post('/treasury/reconciliations', data),
  autoMatch: (id) => api.post(`/treasury/reconciliations/${id}/auto-match`),
  matchWithNewEntry: (id, data) => api.post(`/treasury/reconciliations/${id}/match-with-new-entry`, data),
  reverseMatch: (id, matchId) => api.post(`/treasury/reconciliations/${id}/matches/${matchId}/reverse`),
  complete: (id) => api.post(`/treasury/reconciliations/${id}/complete`),
};

export const creditCardsApi = {
  import: (data) => api.post('/treasury/credit-cards/import', data),
  list: (query) => api.get('/treasury/credit-cards/transactions', query),
  flag: (id, data) => api.patch(`/treasury/credit-cards/transactions/${id}/flag`, data),
  matchPettyCash: (id, pettyCashExpenseId) =>
    api.patch(`/treasury/credit-cards/transactions/${id}/match-petty-cash`, { pettyCashExpenseId }),
};

export const paymentApprovalRulesApi = {
  list: () => api.get('/treasury/payment-approval-rules'),
  create: (data) => api.post('/treasury/payment-approval-rules', data),
  deactivate: (id) => api.post(`/treasury/payment-approval-rules/${id}/deactivate`),
};

export const paymentOrdersApi = {
  list: (query) => api.get('/treasury/payment-orders', query),
  getOne: (id) => api.get(`/treasury/payment-orders/${id}`),
  create: (data) => api.post('/treasury/payment-orders', data),
  submit: (id) => api.post(`/treasury/payment-orders/${id}/submit`),
  decide: (id, data) => api.post(`/treasury/payment-orders/${id}/decide`, data),
  cancel: (id) => api.post(`/treasury/payment-orders/${id}/cancel`),
};

export const paymentBatchesApi = {
  list: () => api.get('/treasury/payment-batches'),
  getOne: (id) => api.get(`/treasury/payment-batches/${id}`),
  create: (data) => api.post('/treasury/payment-batches', data),
  addOrder: (id, paymentOrderId) => api.post(`/treasury/payment-batches/${id}/orders`, { paymentOrderId }),
  removeOrder: (id, orderId) => api.delete(`/treasury/payment-batches/${id}/orders/${orderId}`),
  export: (id) => api.post(`/treasury/payment-batches/${id}/export`),
};

export const debtsApi = {
  list: (query) => api.get('/treasury/debts', query),
  getOne: (id) => api.get(`/treasury/debts/${id}`),
  create: (data) => api.post('/treasury/debts', data),
  disburse: (id) => api.post(`/treasury/debts/${id}/disburse`),
  drawdown: (id, amount, date) => api.post(`/treasury/debts/${id}/drawdown`, { amount, date }),
  repay: (id, amount, date) => api.post(`/treasury/debts/${id}/repay`, { amount, date }),
  payInstallment: (id, installmentId) => api.post(`/treasury/debts/${id}/installments/${installmentId}/pay`),
};

export const pettyCashApi = {
  listFunds: (query) => api.get('/treasury/petty-cash/funds', query),
  getFund: (id) => api.get(`/treasury/petty-cash/funds/${id}`),
  createFund: (data) => api.post('/treasury/petty-cash/funds', data),
  replenish: (id, amount, date) => api.post(`/treasury/petty-cash/funds/${id}/replenish`, { amount, date }),
  listExpenses: (query) => api.get('/treasury/petty-cash/expenses', query),
  registerExpense: (data) => api.post('/treasury/petty-cash/expenses', data),
  decideExpense: (id, data) => api.post(`/treasury/petty-cash/expenses/${id}/decide`, data),
  bulkDecideExpenses: (expenseIds, decision, rejectionReason) =>
    api.post('/treasury/petty-cash/expenses/bulk-decide', { expenseIds, decision, rejectionReason }),
};

export const treasuryAlertsApi = {
  listRules: () => api.get('/treasury/alerts/rules'),
  createRule: (data) => api.post('/treasury/alerts/rules', data),
  deactivateRule: (id) => api.post(`/treasury/alerts/rules/${id}/deactivate`),
  scan: () => api.post('/treasury/alerts/scan'),
  list: (query) => api.get('/treasury/alerts', query),
  acknowledge: (id) => api.post(`/treasury/alerts/${id}/acknowledge`),
};

export const liquidityForecastApi = {
  get: (weeks) => api.get('/treasury/liquidity-forecast', { weeks }),
};

export const paymentCalendarApi = {
  get: (weeks) => api.get('/treasury/payment-calendar', { weeks }),
};
