import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface SessionPayload {
  sub:  string;                 // user id as string
  role: 'user' | 'admin';
  name: string;
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(s);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  const days = parseInt(process.env.JWT_EXPIRY_DAYS ?? '7');
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(getSecret());
}

interface TokenPayload extends JWTPayload {
  sub?:  string;
  role?: 'user' | 'admin';
  name?: string;
  type?: string;
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const verified = payload as TokenPayload;
    // Reject password-reset tokens; they must use verifyResetToken
    if (verified.type === 'password-reset') {
      return null;
    }
    return verified as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function signResetToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, type: 'password-reset' } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecret());
}

export async function verifyResetToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const verified = payload as TokenPayload;
    // Only accept password-reset tokens
    if (verified.type !== 'password-reset') {
      return null;
    }
    return {
      sub:  verified.sub!,
      role: verified.role!,
      name: verified.name!,
    };
  } catch {
    return null;
  }
}
