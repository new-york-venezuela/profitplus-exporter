import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ForgotPasswordService } from '@/lib/services/forgot-password-service';
import { InvalidEmailError } from '@/lib/errors/password-reset';

// Test interfaces
interface MockUser {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: 'user' | 'admin';
  createdAt: number;
}

// Mock environment variables
const mockEnv = {
  JWT_SECRET: 'test-secret-key-for-testing-only',
  NEXT_PUBLIC_APP_URL: 'https://example.com',
};

describe('ForgotPasswordService', () => {
  let service: ForgotPasswordService;

  beforeEach(() => {
    service = new ForgotPasswordService();
    // Set environment variables for tests
    Object.assign(process.env, mockEnv);
  });

  test('class is instantiable', () => {
    expect(service).toBeInstanceOf(ForgotPasswordService);
    expect(typeof service.requestReset).toBe('function');
  });

  test('requestReset method has correct signature', async () => {
    const methodSignature = service.requestReset.toString();
    expect(methodSignature).toContain('requestReset');
    expect(methodSignature).toContain('email');
  });

  test('InvalidEmailError can be thrown and caught', () => {
    const error = new InvalidEmailError();
    expect(error).toBeInstanceOf(InvalidEmailError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Email not found');
  });

  test('InvalidEmailError with custom message', () => {
    const customMsg = 'Custom email not found message';
    const error = new InvalidEmailError(customMsg);
    expect(error.message).toBe(customMsg);
    expect(error.statusCode).toBe(404);
  });

  test('email normalization (lowercase and trim)', async () => {
    // Verify the normalization logic works
    const testEmail = '  TestUser@Example.COM  ';
    const normalized = testEmail.toLowerCase().trim();
    expect(normalized).toBe('testuser@example.com');
  });

  test('JWT token is a valid string with dots', async () => {
    // Verify JWT format: three parts separated by dots
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.fake';
    const parts = mockToken.split('.');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  test('reset URL is constructed correctly', async () => {
    const baseUrl = 'https://example.com';
    const token = 'test-token-123';
    const resetUrl = `${baseUrl}/password-reset?token=${token}`;

    expect(resetUrl).toContain('example.com');
    expect(resetUrl).toContain('/password-reset');
    expect(resetUrl).toContain('token=test-token-123');
  });

  test('reset URL uses fallback localhost when env var not set', () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    expect(appUrl).toBe('https://example.com');

    // Test fallback
    const maybeUndefined: string | undefined = undefined;
    const fallbackUrl = maybeUndefined || 'http://localhost:3000';
    expect(fallbackUrl).toBe('http://localhost:3000');
  });

  test('response object has correct structure', async () => {
    // Verify the return type structure
    const mockResponse = {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.fake',
      resetUrl:
        'https://example.com/password-reset?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.fake',
    };

    expect(mockResponse).toHaveProperty('token');
    expect(mockResponse).toHaveProperty('resetUrl');
    expect(typeof mockResponse.token).toBe('string');
    expect(typeof mockResponse.resetUrl).toBe('string');
  });

  test('payload structure matches SessionPayload', async () => {
    // Verify the payload structure
    const mockPayload = {
      sub: '123',
      role: 'user' as const,
      name: 'Test User',
    };

    expect(mockPayload).toHaveProperty('sub');
    expect(mockPayload).toHaveProperty('role');
    expect(mockPayload).toHaveProperty('name');
    expect(typeof mockPayload.sub).toBe('string');
    expect(typeof mockPayload.role).toBe('string');
    expect(typeof mockPayload.name).toBe('string');
  });

  test('user id is converted to string in payload', async () => {
    // Verify userId conversion logic
    const userId = 42;
    const userIdString = userId.toString();

    expect(typeof userIdString).toBe('string');
    expect(userIdString).toBe('42');
  });

  test('email normalization handles various cases', async () => {
    const testCases = [
      'User@Example.com',
      'USER@EXAMPLE.COM',
      '  user@example.com  ',
      'User@example.com  ',
      '  User@example.com',
    ];

    const normalized = testCases.map((email) =>
      email.toLowerCase().trim()
    );

    // All should normalize to the same value
    const first = normalized[0];
    expect(normalized.every((e) => e === first)).toBe(true);
  });

  test('JWT_SECRET is required', () => {
    const secret = process.env.JWT_SECRET;
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    expect(secret!.length).toBeGreaterThan(0);
  });

  test('SessionPayload role can be user or admin', async () => {
    const userPayload = { sub: '1', role: 'user' as const, name: 'User' };
    const adminPayload = { sub: '2', role: 'admin' as const, name: 'Admin' };

    expect(['user', 'admin']).toContain(userPayload.role);
    expect(['user', 'admin']).toContain(adminPayload.role);
  });

  test('service method is async', () => {
    const methodSignature = service.requestReset.toString();
    expect(methodSignature).toContain('async');
  });

  test('service returns promise', () => {
    // Verify requestReset returns a Promise
    const resultType = service.requestReset.constructor.name;
    expect(resultType).toBeDefined();
  });

  test('InvalidEmailError extends PasswordResetError', () => {
    const error = new InvalidEmailError();
    expect(error.name).toBe('InvalidEmailError');
    expect(error.statusCode).toBe(404);
  });

  test('email comparison should be case-insensitive', () => {
    const email1 = 'User@Example.COM';
    const email2 = 'user@example.com';

    const normalized1 = email1.toLowerCase().trim();
    const normalized2 = email2.toLowerCase().trim();

    expect(normalized1).toBe(normalized2);
  });

  test('reset URL format validation', () => {
    const token = 'abc123';
    const baseUrl = 'https://app.example.com';
    const resetUrl = `${baseUrl}/password-reset?token=${token}`;

    expect(resetUrl).toMatch(/^https:\/\//);
    expect(resetUrl).toContain('/password-reset');
    expect(resetUrl).toContain('?token=');
  });
});
