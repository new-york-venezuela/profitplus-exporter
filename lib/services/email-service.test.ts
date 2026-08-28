import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

describe('invoice-reminder.hbs template', () => {
  test('renders invoice tables from array data without a helper registration', () => {
    const templatePath = path.join(process.cwd(), 'lib', 'email', 'templates', 'invoice-reminder.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    const html = template({
      cliDes: 'Cliente De Prueba',
      dueSoon: [{ nroDoc: 'B0001', nControl: '00-001', fecVenc: '2026-09-01', saldoBs: '500.00', saldoUsd: '10.00' }],
      dueToday: [],
      overdue: [{ nroDoc: 'B0002', nControl: '00-002', fecVenc: '2026-08-20', saldoBs: '300.00', saldoUsd: '6.00', diasVencido: 8 }],
    });

    expect(html).toContain('Cliente De Prueba');
    expect(html).toContain('B0001');
    expect(html).toContain('B0002');
    expect(html).toContain('500.00');
    expect(html).toContain('6.00');
  });

  test('omits a section entirely when its array is empty', () => {
    const templatePath = path.join(process.cwd(), 'lib', 'email', 'templates', 'invoice-reminder.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);

    const html = template({
      cliDes: 'Cliente Dos',
      dueSoon: [],
      dueToday: [],
      overdue: [{ nroDoc: 'B0003', nControl: null, fecVenc: '2026-08-20', saldoBs: '100.00', saldoUsd: '2.00', diasVencido: 3 }],
    });

    expect(html).not.toContain('Vence pronto');
    expect(html).toContain('Vencidas');
  });
});
