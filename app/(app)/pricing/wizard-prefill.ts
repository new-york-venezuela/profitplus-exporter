/** Prefill handed to the promotion wizard by "Duplicar". */
export interface WizardPrefill {
  name: string;
  reason: string | null;
  kind: 'overlay' | 'segment';
  coPrecio: string;
  baseCoPrecio: string | null;
  items: { coArt: string; monto: number }[];
  customers: { coCli: string }[];
}
