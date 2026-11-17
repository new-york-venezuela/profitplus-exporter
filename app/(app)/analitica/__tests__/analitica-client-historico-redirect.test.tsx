import '../../../../test/dom-setup';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

const replaced: string[] = [];
let search = '';
mock.module('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: (u: string) => { replaced.push(u); } }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/analitica',
}));
mock.module('posthog-js', () => ({ default: { capture: () => {} } }));

const { AnaliticaClient } = await import('../analitica-client');

beforeEach(() => {
  replaced.length = 0;
  globalThis.fetch = mock(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
});
afterEach(cleanup);

describe('retired Histórico 2025 tab', () => {
  test('an old ?tab=historico link is redirected to Analítica histórica', () => {
    search = 'tab=historico';
    render(<AnaliticaClient />);
    expect(replaced).toEqual(['/analitica-historica']);
  });

  test('other tabs are not redirected', () => {
    search = 'tab=ventas';
    render(<AnaliticaClient />);
    expect(replaced).toEqual([]);
  });
});
