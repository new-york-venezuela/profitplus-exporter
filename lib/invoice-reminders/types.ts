export interface ReminderInvoice {
  nroDoc:      string;
  nControl:    string | null;
  fecVenc:     Date;
  saldoBs:     number;
  saldoUsd:    number;
  diasVencido: number; // negative = due within thresholdDays, 0 = due today, positive = overdue
}

export interface CustomerInvoiceGroup {
  coCli:    string;
  cliDes:   string;
  email:    string;
  dueSoon:  ReminderInvoice[];
  dueToday: ReminderInvoice[];
  overdue:  ReminderInvoice[];
}

export interface RawInvoiceRow {
  co_cli:   string;
  cli_des:  string;
  email:    string;
  nro_doc:  string;
  n_control: string | null;
  fec_venc: Date;
  saldo:    number;
  tasa:     number;
}
