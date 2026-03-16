import { signJwt } from '../../src/common/utils/jwt.js';
import mongoose from 'mongoose';

const ACCESS_SECRET = 'test-jwt-access-secret-that-is-at-least-32-chars';
const REFRESH_SECRET = 'test-jwt-refresh-secret-that-is-at-least-32-chars';

export interface TestUser {
  userId: string;
  email: string;
}

export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  return {
    userId: new mongoose.Types.ObjectId().toString(),
    email: 'test@example.com',
    ...overrides,
  };
}

export function generateAccessToken(user: TestUser): string {
  return signJwt(
    { userId: user.userId, email: user.email },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

export function generateRefreshToken(user: TestUser): string {
  return signJwt(
    { userId: user.userId, email: user.email },
    REFRESH_SECRET,
    { expiresIn: '7d' },
  );
}

export function generateExpiredToken(user: TestUser): string {
  return signJwt(
    { userId: user.userId, email: user.email },
    ACCESS_SECRET,
    { expiresIn: '0s' },
  );
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
