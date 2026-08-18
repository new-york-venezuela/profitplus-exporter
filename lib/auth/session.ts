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

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const verified = payload as unknown as SessionPayload;
    // Reject password-reset tokens; they must use verifyResetToken
    if ((payload as any).type === 'password-reset') {
      return null;
    }
    return verified;
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
    // Only accept password-reset tokens
    if ((payload as any).type !== 'password-reset') {
      return null;
    }
    return {
      sub: (payload as any).sub,
      role: (payload as any).role,
      name: (payload as any).name,
    };
  } catch {
    return null;
  }
}
