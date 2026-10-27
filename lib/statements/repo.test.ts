import { describe, test, expect } from 'bun:test';
import { dbDateToLocal, mapDocRow, mapRateRows } from './repo';

describe('dbDateToLocal', () => {
  test('UTC-midnight becomes local midnight of the same y/m/d', () => {
    const d = dbDateToLocal(new Date(Date.UTC(2026, 2, 5)));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('mapDocRow', () => {
  test('trims, upper-cases type, numeric saldo, local dates', () => {
    const doc = mapDocRow({
      co_tipo_doc: 'fact  ', nro_doc: ' 00012  ',
      fec_emis: new Date(Date.UTC(2026, 0, 31)), fec_venc: new Date(Date.UTC(2026, 1, 15)),
      saldo: '123.45',
    });
    expect(doc.coTipoDoc).toBe('FACT');
    expect(doc.nroDoc).toBe('00012');
    expect(doc.saldoBsd).toBe(123.45);
    expect(doc.fecEmis.getDate()).toBe(31);
    expect(doc.fecVenc!.getMonth()).toBe(1);
  });
  test('null fec_venc stays null', () => {
    const doc = mapDocRow({ co_tipo_doc: 'FACT', nro_doc: '1', fec_emis: new Date(Date.UTC(2026, 0, 1)), fec_venc: null, saldo: 1 });
    expect(doc.fecVenc).toBeNull();
  });
});

describe('mapRateRows', () => {
  test('keeps the time of day (local Date from UTC components)', () => {
    const out = mapRateRows([{ fecha: new Date(Date.UTC(2026, 0, 2, 15, 30, 5, 123)), tasa_v: 41 }]);
    const f = out[0].fecha;
    expect([f.getFullYear(), f.getMonth(), f.getDate()]).toEqual([2026, 0, 2]);
    expect([f.getHours(), f.getMinutes(), f.getSeconds(), f.getMilliseconds()]).toEqual([15, 30, 5, 123]);
  });
  test('drops null/zero/negative rates and converts dates', () => {
    const d = new Date(Date.UTC(2026, 0, 2));
    const out = mapRateRows([
      { fecha: d, tasa_v: 40 }, { fecha: d, tasa_v: 0 }, { fecha: d, tasa_v: null }, { fecha: d, tasa_v: -1 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].tasaV).toBe(40);
    expect(out[0].fecha.getDate()).toBe(2);
  });
});
