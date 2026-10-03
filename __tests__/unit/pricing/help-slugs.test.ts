import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

// HELP_PAGES is a private allowlist in the route; read its source instead of importing the route handler.
const root = path.resolve(import.meta.dir, '..', '..', '..');
const route = readFileSync(path.join(root, 'app/api/help/[page]/route.ts'), 'utf-8');
const list = /HELP_PAGES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(route)?.[1] ?? '';
const slugs = [...list.matchAll(/'([^']+)'/g)].map(m => m[1]);

describe('help pages', () => {
  test('the allowlist was parsed', () => {
    expect(slugs.length).toBeGreaterThan(0);
    for (const s of ['pricing-segmentos', 'pricing-listas', 'pricing-promociones']) expect(slugs).toContain(s);
  });
  test('every pricing-* slug has a content file', () => {
    for (const s of slugs.filter(x => x.startsWith('pricing-'))) {
      expect(existsSync(path.join(root, 'content/help', `${s}.md`))).toBe(true);
    }
  });
});
