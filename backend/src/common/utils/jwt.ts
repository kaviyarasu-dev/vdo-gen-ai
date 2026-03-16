import { createHmac, timingSafeEqual } from 'node:crypto';

export interface JwtSignOptions {
  expiresIn: string;
}

interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

interface JwtClaims {
  [key: string]: unknown;
  iat: number;
  exp: number;
}

const DURATION_MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3_600,
  d: 86_400,
  w: 604_800,
};

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(encoded: string): string {
  const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function createSignature(input: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(input)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Parse a duration string (e.g. "15m", "7d", "1h", "30s") into seconds.
 */
export function parseDuration(duration: string): number {
  const match = /^(\d+)\s*([smhdw])$/i.exec(duration.trim());

  if (!match) {
    throw new Error(`Invalid duration format: "${duration}". Use formats like "15m", "1h", "7d".`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multiplier = DURATION_MULTIPLIERS[unit];

  if (multiplier === undefined) {
    throw new Error(`Unknown duration unit: "${unit}"`);
  }

  return value * multiplier;
}

/**
 * Sign a JWT with HS256 using Node's built-in crypto module.
 */
export function signJwt<T extends object>(
  payload: T,
  secret: string,
  options: JwtSignOptions,
): string {
  const now = Math.floor(Date.now() / 1_000);
  const expiresInSeconds = parseDuration(options.expiresIn);

  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const claims: JwtClaims = { ...(payload as Record<string, unknown>), iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSignature(signingInput, secret);

  return `${signingInput}.${signature}`;
}

/**
 * Verify and decode a JWT signed with HS256.
 * Returns the decoded payload if valid, otherwise throws.
 */
export function verifyJwt<T extends object>(
  token: string,
  secret: string,
): T & { iat: number; exp: number } {
  const segments = token.split('.');

  if (segments.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = segments as [string, string, string];
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createSignature(signingInput, secret);

  // Use timing-safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error('Invalid token signature');
  }

  const headerJson = base64UrlDecode(encodedHeader);
  const header = JSON.parse(headerJson) as { alg: string; typ: string };

  if (header.alg !== 'HS256') {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  const payloadJson = base64UrlDecode(encodedPayload);
  const claims = JSON.parse(payloadJson) as T & { iat: number; exp: number };

  const now = Math.floor(Date.now() / 1_000);

  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    throw new Error('Token has expired');
  }

  return claims;
}
