export class PasswordResetError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, PasswordResetError.prototype);
  }
}

export class InvalidCredentialError extends PasswordResetError {
  constructor(message = 'Current password is incorrect') {
    super(401, message);
    Object.setPrototypeOf(this, InvalidCredentialError.prototype);
  }
}

export class InvalidEmailError extends PasswordResetError {
  constructor(message = 'Email not found') {
    super(404, message);
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}

export class TokenExpiredError extends PasswordResetError {
  constructor(message = 'Token expired or invalid') {
    super(401, message);
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

export class SMTPError extends PasswordResetError {
  constructor(message = 'Failed to send email') {
    super(500, message);
    Object.setPrototypeOf(this, SMTPError.prototype);
  }
}

export class TemplateNotFoundError extends PasswordResetError {
  constructor(templateName: string) {
    super(500, `Email template not found: ${templateName}`);
    Object.setPrototypeOf(this, TemplateNotFoundError.prototype);
  }
}
