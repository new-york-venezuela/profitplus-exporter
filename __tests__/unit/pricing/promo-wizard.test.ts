import { describe, test, expect } from 'bun:test';
import { buildCreateBody, copyName, durationText, endsInText, validateStep, type WizardFields } from '@/lib/pricing/promo-wizard';
import { validateCreatePromotionBody } from '@/lib/pricing/promo-validators';

const base: WizardFields = {
  name: 'Oferta', reason: '', kind: 'overlay', listCo: '01', customerCodes: [], itemCount: 1, startsOn: '2026-10-05', endsOn: '2026-10-09',
};
const TODAY = '2026-10-03';

describe('copyName', () => {
  test('appends the suffix', () => expect(copyName('Oferta')).toBe('Oferta (copia)'));
  test('truncates to 40 keeping the suffix', () => {
    const r = copyName('x'.repeat(60));
    expect(r.length).toBeLessThanOrEqual(40);
    expect(r.endsWith(' (copia)')).toBe(true);
  });
});

describe('validateStep', () => {
  test('step 1 requires name and list', () => {
    expect(validateStep(1, { ...base, name: ' ', listCo: null }, TODAY)).toEqual({ name: 'El nombre es requerido', list: 'Elige la lista de precios' });
  });
  test('step 1 name over 40', () => expect(validateStep(1, { ...base, name: 'x'.repeat(41) }, TODAY).name).toBeTruthy());
  test('segment kind needs customers, max 500', () => {
    expect(validateStep(1, { ...base, kind: 'segment' }, TODAY).customers).toBeTruthy();
    expect(validateStep(1, { ...base, kind: 'segment', customerCodes: Array.from({ length: 501 }, (_, i) => `C${i}`) }, TODAY).customers).toBeTruthy();
    expect(validateStep(1, { ...base, kind: 'segment', customerCodes: ['C1'] }, TODAY)).toEqual({});
  });
  test('step 2 needs an item', () => {
    expect(validateStep(2, { ...base, itemCount: 0 }, TODAY).items).toBeTruthy();
    expect(validateStep(2, base, TODAY)).toEqual({});
  });
  test('step 2 caps at 200 items', () => {
    expect(validateStep(2, { ...base, itemCount: 200 }, TODAY)).toEqual({});
    expect(validateStep(2, { ...base, itemCount: 201 }, TODAY).items).toBe('Máximo 200 artículos por promoción; selecciona menos');
  });
  test('step 3 dates', () => {
    expect(validateStep(3, base, TODAY)).toEqual({});
    expect(validateStep(3, { ...base, startsOn: '2026-10-02' }, TODAY).startsOn).toBeTruthy();
    expect(validateStep(3, { ...base, startsOn: '2026-10-03', endsOn: '2026-10-03' }, TODAY)).toEqual({});
    expect(validateStep(3, { ...base, endsOn: '2026-10-04' }, TODAY).endsOn).toBeTruthy();
    expect(validateStep(3, { ...base, startsOn: '', endsOn: '' }, TODAY)).toEqual({ startsOn: 'Indica la fecha de inicio', endsOn: 'Indica la fecha de fin' });
  });
});

describe('texts', () => {
  test('endsInText', () => {
    expect(endsInText(TODAY, '2026-10-03')).toBe('Termina hoy');
    expect(endsInText(TODAY, '2026-10-04')).toBe('Termina en 1 día');
    expect(endsInText(TODAY, '2026-10-09')).toBe('Termina en 6 días');
    expect(endsInText(TODAY, '2026-10-01')).toBe('');
  });
  test('durationText', () => {
    expect(durationText('2026-10-05', '2026-10-05')).toBe('Dura 1 día');
    expect(durationText('2026-10-05', '2026-10-09')).toBe('Dura 5 días');
  });
});

describe('buildCreateBody', () => {
  const items = [{ coArt: 'A1', monto: 5 }];
  test('overlay body passes the server validator', () => {
    const body = buildCreateBody({ name: ' Oferta ', reason: ' ', kind: 'overlay', listCo: '01', customerCodes: ['IGNORED'], startsOn: '2026-10-05', endsOn: '2026-10-09', items });
    expect(body).toEqual({ kind: 'overlay', coPrecio: '01', name: 'Oferta', reason: null, startsOn: '2026-10-05', endsOn: '2026-10-09', items });
    expect(validateCreatePromotionBody(body, TODAY).ok).toBe(true);
  });
  test('segment body passes the server validator', () => {
    const body = buildCreateBody({ name: 'Seg', reason: 'x', kind: 'segment', listCo: '01', customerCodes: ['C1'], startsOn: '2026-10-05', endsOn: '2026-10-09', items });
    expect(body.kind).toBe('segment');
    expect(validateCreatePromotionBody(body, TODAY).ok).toBe(true);
  });
});
