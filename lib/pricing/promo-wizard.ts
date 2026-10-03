// Pure helpers of the promotion creation wizard (validation, request building, prefill). No React.
import { daysBetweenIso, isValidIsoDate } from './dates';

export const NAME_MAX = 40;
export const REASON_MAX = 200;
export const CUSTOMERS_MAX = 500;

export interface WizardFields {
  name: string;
  reason: string;
  kind: 'overlay' | 'segment';
  listCo: string | null;
  customerCodes: string[];
  itemCount: number;
  startsOn: string;
  endsOn: string;
}

export type StepErrors = Partial<Record<'name' | 'reason' | 'list' | 'customers' | 'items' | 'startsOn' | 'endsOn', string>>;

/** "Nombre (copia)", always ≤ 40 characters and always ending in the suffix. */
export function copyName(name: string): string {
  const suffix = ' (copia)';
  const base = name.trim();
  return base.length + suffix.length <= NAME_MAX ? base + suffix : base.slice(0, NAME_MAX - suffix.length).trimEnd() + suffix;
}

export function validateStep(step: 1 | 2 | 3, f: WizardFields, today: string): StepErrors {
  const e: StepErrors = {};
  if (step === 1) {
    const n = f.name.trim();
    if (n.length === 0) e.name = 'El nombre es requerido';
    else if (n.length > NAME_MAX) e.name = `El nombre no puede exceder ${NAME_MAX} caracteres`;
    if (f.reason.trim().length > REASON_MAX) e.reason = `El motivo no puede exceder ${REASON_MAX} caracteres`;
    if (!f.listCo) e.list = f.kind === 'overlay' ? 'Elige la lista de precios' : 'Elige la lista base';
    if (f.kind === 'segment') {
      if (f.customerCodes.length === 0) e.customers = 'Elige al menos un cliente';
      else if (f.customerCodes.length > CUSTOMERS_MAX) e.customers = `Máximo ${CUSTOMERS_MAX} clientes`;
    }
  } else if (step === 2) {
    if (f.itemCount === 0) e.items = 'Fija el precio promocional de al menos un artículo';
  } else {
    if (!isValidIsoDate(f.startsOn)) e.startsOn = 'Indica la fecha de inicio';
    else if (f.startsOn < today) e.startsOn = 'La fecha de inicio no puede ser anterior a hoy';
    if (!isValidIsoDate(f.endsOn)) e.endsOn = 'Indica la fecha de fin';
    else if (isValidIsoDate(f.startsOn) && f.endsOn < f.startsOn) e.endsOn = 'La fecha de fin no puede ser anterior al inicio';
  }
  return e;
}

/** "Termina en N días" (counted from today; the end date is inclusive). */
export function endsInText(today: string, endsOn: string): string {
  if (!isValidIsoDate(endsOn)) return '';
  const n = daysBetweenIso(today, endsOn);
  if (n < 0) return '';
  if (n === 0) return 'Termina hoy';
  return n === 1 ? 'Termina en 1 día' : `Termina en ${n} días`;
}

export function durationText(startsOn: string, endsOn: string): string {
  if (!isValidIsoDate(startsOn) || !isValidIsoDate(endsOn) || endsOn < startsOn) return '';
  const n = daysBetweenIso(startsOn, endsOn) + 1;
  return n === 1 ? 'Dura 1 día' : `Dura ${n} días`;
}

export interface BodyInput {
  name: string;
  reason: string;
  kind: 'overlay' | 'segment';
  listCo: string;
  customerCodes: string[];
  startsOn: string;
  endsOn: string;
  items: { coArt: string; monto: number }[];
}

export function buildCreateBody(i: BodyInput) {
  const common = {
    name: i.name.trim(), reason: i.reason.trim() || null, startsOn: i.startsOn, endsOn: i.endsOn, items: i.items,
  };
  return i.kind === 'overlay'
    ? { kind: 'overlay' as const, coPrecio: i.listCo, ...common }
    : { kind: 'segment' as const, baseCoPrecio: i.listCo, customerCodes: i.customerCodes, ...common };
}
