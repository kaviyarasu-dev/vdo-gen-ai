import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

import { buildTestApp } from '../../helpers/app.helper.js';
import { createUser } from '../../helpers/db.helper.js';
import { generateAccessToken, generateRefreshToken, createTestUser, authHeader } from '../../helpers/auth.helper.js';

describe('Auth API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/v1/auth/register ──

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'newuser@example.com',
          password: 'securePassword123',
          name: 'New User',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('user');
      expect(body.user.email).toBe('newuser@example.com');
      expect(body.user.name).toBe('New User');
      expect(body.user).not.toHaveProperty('passwordHash');
      expect(body.user).not.toHaveProperty('refreshTokens');
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('should reject duplicate email', async () => {
      const existingUser = await createUser({ email: 'duplicate@example.com' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: existingUser.email,
          password: 'securePassword123',
          name: 'Another User',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Email is already registered');
    });

    it('should reject invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'securePassword123',
          name: 'Bad Email User',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'shortpass@example.com',
          password: 'short',
          name: 'Short Pass User',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject password exceeding max length', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'longpass@example.com',
          password: 'a'.repeat(129),
          name: 'Long Pass User',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should normalize email to lowercase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'UpperCase@Example.COM',
          password: 'securePassword123',
          name: 'Case Test User',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.user.email).toBe('uppercase@example.com');
    });
  });

  // ── POST /api/v1/auth/login ──

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials and return tokens', async () => {
      // Create user via registration first so password is known
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'login-user@example.com',
          password: 'correctPassword123',
          name: 'Login User',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login-user@example.com',
          password: 'correctPassword123',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body).toHaveProperty('user');
      expect(body.user.email).toBe('login-user@example.com');
      expect(body.user.name).toBe('Login User');
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject invalid password', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'wrong-pass@example.com',
          password: 'correctPassword123',
          name: 'Wrong Pass User',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'wrong-pass@example.com',
          password: 'wrongPassword123',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'anyPassword123',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Invalid email or password');
    });

    it('should reject missing email field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          password: 'somePassword123',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── POST /api/v1/auth/refresh ──

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // Register to get a valid refresh token stored in the DB
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'refresh-user@example.com',
          password: 'securePassword123',
          name: 'Refresh User',
        },
      });

      const { refreshToken } = registerResponse.json();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
      // New tokens should differ from old ones (token rotation)
      expect(body.refreshToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'totally-invalid-token' },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject reuse of already-rotated refresh token', async () => {
      // Register and get a refresh token
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'reuse-test@example.com',
          password: 'securePassword123',
          name: 'Reuse Test User',
        },
      });

      const { refreshToken: originalToken } = registerResponse.json();

      // Use it once to rotate
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: originalToken },
      });

      // Try using the old token again -- should fail (reuse detection)
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: originalToken },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject empty refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: '' },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── POST /api/v1/auth/logout ──

  describe('POST /api/v1/auth/logout', () => {
    it('should logout and invalidate refresh token', async () => {
      // Register to get both tokens
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'logout-user@example.com',
          password: 'securePassword123',
          name: 'Logout User',
        },
      });

      const { accessToken, refreshToken } = registerResponse.json();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: authHeader(accessToken),
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.message).toBe('Logged out');

      // Verify the refresh token is now invalid
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });

      expect(refreshResponse.statusCode).toBe(401);
    });

    it('should reject request without auth header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: 'some-token' },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with invalid access token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: authHeader('invalid-access-token'),
        payload: { refreshToken: 'some-token' },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request without refresh token in body', async () => {
      // Register to get a valid access token
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'logout-nobody@example.com',
          password: 'securePassword123',
          name: 'Logout NoBody User',
        },
      });

      const { accessToken } = registerResponse.json();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: authHeader(accessToken),
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
