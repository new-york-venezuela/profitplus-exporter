// __tests__/unit/pricing/http.test.ts
import { describe, test, expect } from 'bun:test';
import { serviceErrorResponse } from '@/lib/pricing/http';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/pricing/segments-service';

describe('serviceErrorResponse', () => {
  test('maps typed errors to status + { error }', async () => {
    const r404 = serviceErrorResponse(new NotFoundError('no'))!;
    expect(r404.status).toBe(404);
    expect(await r404.json()).toEqual({ error: 'no' });
    expect(serviceErrorResponse(new ConflictError('c'))!.status).toBe(409);
    expect(serviceErrorResponse(new ValidationError('v'))!.status).toBe(400);
  });
  test('returns null for unknown errors', () => {
    expect(serviceErrorResponse(new Error('boom'))).toBeNull();
  });
});
