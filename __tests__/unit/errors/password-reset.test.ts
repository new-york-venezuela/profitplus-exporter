import { describe, test, expect } from 'bun:test';
import {
  PasswordResetError,
  InvalidCredentialError,
  InvalidEmailError,
  TokenExpiredError,
  SMTPError,
  TemplateNotFoundError,
} from '../../../lib/errors/password-reset';

describe('PasswordResetError', () => {
  test('instantiates with statusCode and message', () => {
    const error = new PasswordResetError(400, 'Test error');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('PasswordResetError');
  });

  test('instanceof checks work for base class', () => {
    const error = new PasswordResetError(400, 'Test');
    expect(error instanceof PasswordResetError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('InvalidCredentialError', () => {
  test('instantiates with correct statusCode', () => {
    const error = new InvalidCredentialError();
    expect(error.statusCode).toBe(401);
  });

  test('has correct default message', () => {
    const error = new InvalidCredentialError();
    expect(error.message).toBe('Current password is incorrect');
  });

  test('custom message overrides default', () => {
    const error = new InvalidCredentialError('Custom credential error');
    expect(error.message).toBe('Custom credential error');
  });

  test('instanceof checks work', () => {
    const error = new InvalidCredentialError();
    expect(error instanceof InvalidCredentialError).toBe(true);
    expect(error instanceof PasswordResetError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('InvalidEmailError', () => {
  test('instantiates with correct statusCode', () => {
    const error = new InvalidEmailError();
    expect(error.statusCode).toBe(404);
  });

  test('has correct default message', () => {
    const error = new InvalidEmailError();
    expect(error.message).toBe('Email not found');
  });

  test('custom message overrides default', () => {
    const error = new InvalidEmailError('Custom email error');
    expect(error.message).toBe('Custom email error');
  });

  test('instanceof checks work', () => {
    const error = new InvalidEmailError();
    expect(error instanceof InvalidEmailError).toBe(true);
    expect(error instanceof PasswordResetError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('TokenExpiredError', () => {
  test('instantiates with correct statusCode', () => {
    const error = new TokenExpiredError();
    expect(error.statusCode).toBe(401);
  });

  test('has correct default message', () => {
    const error = new TokenExpiredError();
    expect(error.message).toBe('Token expired or invalid');
  });

  test('custom message overrides default', () => {
    const error = new TokenExpiredError('Custom token error');
    expect(error.message).toBe('Custom token error');
  });

  test('instanceof checks work', () => {
    const error = new TokenExpiredError();
    expect(error instanceof TokenExpiredError).toBe(true);
    expect(error instanceof PasswordResetError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('SMTPError', () => {
  test('instantiates with correct statusCode', () => {
    const error = new SMTPError();
    expect(error.statusCode).toBe(500);
  });

  test('has correct default message', () => {
    const error = new SMTPError();
    expect(error.message).toBe('Failed to send email');
  });

  test('custom message overrides default', () => {
    const error = new SMTPError('Custom SMTP error');
    expect(error.message).toBe('Custom SMTP error');
  });

  test('instanceof checks work', () => {
    const error = new SMTPError();
    expect(error instanceof SMTPError).toBe(true);
    expect(error instanceof PasswordResetError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('TemplateNotFoundError', () => {
  test('instantiates with correct statusCode', () => {
    const error = new TemplateNotFoundError('reset.hbs');
    expect(error.statusCode).toBe(500);
  });

  test('constructs message with template name', () => {
    const error = new TemplateNotFoundError('reset.hbs');
    expect(error.message).toBe('Email template not found: reset.hbs');
  });

  test('works with different template names', () => {
    const error1 = new TemplateNotFoundError('confirm.hbs');
    expect(error1.message).toBe('Email template not found: confirm.hbs');

    const error2 = new TemplateNotFoundError('welcome.hbs');
    expect(error2.message).toBe('Email template not found: welcome.hbs');
  });

  test('instanceof checks work', () => {
    const error = new TemplateNotFoundError('reset.hbs');
    expect(error instanceof TemplateNotFoundError).toBe(true);
    expect(error instanceof PasswordResetError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});
