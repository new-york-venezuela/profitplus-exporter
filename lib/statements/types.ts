export interface StatementDoc {
  coTipoDoc: string;
  nroDoc: string;
  fecEmis: Date;
  fecVenc: Date | null;
  saldoBsd: number;
}

export interface UsdRate {
  fecha: Date;
  tasaV: number;
}

export interface StatementRow {
  kind: 'debt' | 'reducing';
  coTipoDoc: string;
  nroDoc: string;
  fecEmis: Date;
  fecVenc: Date | null;
  daysOverdue: number | null;
  /** Negative for reducing rows. */
  amountBsd: number;
  rate: number | null;
  /** Negative for reducing rows; null when no rate exists. */
  amountUsd: number | null;
  unknownType: boolean;
}

export interface Money {
  bsd: number;
  usd: number;
}

export interface Statement {
  asOf: Date;
  rows: StatementRow[];
  aging: {
    porVencer: Money;
    d1_30: Money;
    d31_60: Money;
    d61_90: Money;
    d90plus: Money;
  };
  credits: Money;
  total: Money;
  incomplete: boolean;
}
