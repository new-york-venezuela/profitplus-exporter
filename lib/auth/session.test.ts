import { describe, test, expect, beforeAll } from 'bun:test';
import { signToken, verifyToken, type SessionPayload } from './session';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-exactly-32-chars-long-here';
  process.env.JWT_EXPIRY_DAYS = '7';
});

const payload: SessionPayload = { sub: '42', role: 'admin', name: 'Ana García' };

describe('signToken / verifyToken', () => {
  test('signs a token and verifies it round-trip', async () => {
    const token = await signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

    const result = await verifyToken(token);
    expect(result?.sub).toBe('42');
    expect(result?.role).toBe('admin');
    expect(result?.name).toBe('Ana García');
  });

  test('returns null for a completely invalid token', async () => {
    expect(await verifyToken('not.a.jwt')).toBeNull();
  });

  test('returns null for a tampered token', async () => {
    const token = await signToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(await verifyToken(tampered)).toBeNull();
  });

  test('throws if JWT_SECRET is not set', async () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => signToken(payload)).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = original;
  });
});
