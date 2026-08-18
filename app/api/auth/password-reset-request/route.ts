import { NextRequest, NextResponse } from 'next/server';
import { ForgotPasswordService } from '@/lib/services/forgot-password-service';
import { EmailService } from '@/lib/services/email-service';
import { InvalidEmailError, SMTPError } from '@/lib/errors/password-reset';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Step 1: Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Step 2: Extract email from body
  const { email } = body as Record<string, unknown>;

  // Step 3: Validate input
  if (!email || typeof email !== 'string') {
    return NextResponse.json(
      { error: 'Email is required' },
      { status: 400 }
    );
  }

  // Step 4: Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Step 5: Create ForgotPasswordService instance
  const service = new ForgotPasswordService();

  // Step 6: Call service.requestReset()
  let resetUrl: string;
  let userName: string;
  try {
    const result = await service.requestReset(normalizedEmail);
    resetUrl = result.resetUrl;
    userName = result.name;
  } catch (error) {
    // Step 9: Handle service errors
    if (error instanceof InvalidEmailError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    // Catch other errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  // Step 7: Create EmailService instance
  const emailService = new EmailService();

  // Step 8: Send email
  try {
    await emailService.send(normalizedEmail, 'password-reset', {
      userName,
      resetUrl,
      resetUrlPlain: resetUrl,
    });
  } catch (error) {
    // Catch SMTPError
    if (error instanceof SMTPError) {
      console.error('Failed to send password reset email:', error.message);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    // Catch other errors
    console.error('Unexpected error sending password reset email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }

  // Step 10: Return 200 with success message
  return NextResponse.json({
    ok: true,
    message: 'Check your email for password reset instructions',
  });
}
