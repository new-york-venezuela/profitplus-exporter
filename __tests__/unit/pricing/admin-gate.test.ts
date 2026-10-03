import { describe, test, expect } from 'bun:test';
import { decideAdmin, isAdminSession } from '@/lib/pricing/http';

describe('admin gate', () => {
  test('pricing_edit user with role user is forbidden; admin is ok', () => {
    expect(decideAdmin('edit', 'user')).toBe('forbidden');
    expect(decideAdmin('view', 'user')).toBe('forbidden');
    expect(decideAdmin('edit', 'admin')).toBe('ok');
  });
  test('isAdminSession', () => {
    expect(isAdminSession({ sub: '1', role: 'admin', name: 'a' } as never)).toBe(true);
    expect(isAdminSession({ sub: '1', role: 'user', name: 'a' } as never)).toBe(false);
  });
});
