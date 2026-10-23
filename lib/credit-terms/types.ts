export const CREDIT_DAYS = [7, 15, 21, 35] as const;
export type CreditDays = typeof CREDIT_DAYS[number];

/** saCondicionPago code for each supported term (000015 is created by migration 0019). */
export const CO_COND_BY_DAYS: Record<CreditDays, string> = {
  7: '000002',
  15: '000003',
  21: '000004',
  35: '000015',
};

export const CREDIT_SOURCES = ['exact', 'fuzzy', 'inherited', 'override', 'skip', 'review'] as const;
export type CreditSource = typeof CREDIT_SOURCES[number];

export interface CreditTermRow {
  coCli: string;
  nombre: string;
  diasCred: CreditDays | null;  // null only for skip / review rows
  source: CreditSource;
  note: string;
}

export const CREDIT_TERM_COLUMNS = ['co_cli', 'nombre', 'dias_cred', 'source', 'note'] as const;

export interface ErpCreditCustomer {
  coCli: string;
  condPag: string;
  plazPag: number;
  inactivo: boolean;
}
