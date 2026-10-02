import { describe, expect, test } from 'bun:test';
import { visibleNavSections, type NavAccess } from '@/lib/nav';

const none: NavAccess = {
  isAdmin: false,
  inventory: false,
  dwh: false,
  geo: false,
  pricing: 'none',
};

const hrefs = (access: NavAccess) =>
  visibleNavSections(access).flatMap(s => s.links.map(l => l.href));

describe('visibleNavSections', () => {
  test('plain user sees only reports and tools', () => {
    expect(hrefs(none)).toEqual([
      '/reports/ventas',
      '/reports/compras',
      '/firmas',
      '/qr',
    ]);
  });

  test('each module grant adds only its own section', () => {
    expect(hrefs({ ...none, dwh: true })).toContain('/analitica');
    expect(hrefs({ ...none, dwh: true })).not.toContain('/mapa');
    expect(hrefs({ ...none, geo: true })).toContain('/mapa');
    expect(hrefs({ ...none, inventory: true })).toEqual(
      expect.arrayContaining(['/inventario/dashboard', '/inventario/articulos', '/inventario/ajustes']),
    );
    expect(hrefs({ ...none, pricing: 'view' })).toContain('/pricing');
  });

  test('admin links require isAdmin', () => {
    expect(hrefs(none).some(h => h.startsWith('/admin'))).toBe(false);
    expect(hrefs({ ...none, isAdmin: true })).toEqual(
      expect.arrayContaining(['/admin/users', '/admin/config-inventario', '/admin/config-cobranza']),
    );
  });

  test('omits sections with no visible links', () => {
    const titles = visibleNavSections(none).map(s => s.title);
    expect(titles).toEqual(['Reportes', 'Herramientas']);
  });
});
