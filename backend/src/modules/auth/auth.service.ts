import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { ValidationError, UnauthorizedError } from '../../common/errors/index.js';
import { signJwt, verifyJwt } from '../../common/utils/jwt.js';
import { logger } from '../../common/utils/logger.js';
import type { UserRepository } from '../users/user.repository.js';
import type { IUserDocument } from '../users/user.types.js';
import type { RegisterDto, LoginDto, AuthTokens, JwtPayload } from './auth.types.js';

interface AuthServiceDeps {
  userRepository: UserRepository;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

interface AuthResult {
  user: IUserDocument;
  tokens: AuthTokens;
}

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(deps: AuthServiceDeps) {
    this.userRepository = deps.userRepository;
    this.jwtAccessSecret = deps.jwtAccessSecret;
    this.jwtRefreshSecret = deps.jwtRefreshSecret;
    this.accessExpiresIn = deps.accessExpiresIn;
    this.refreshExpiresIn = deps.refreshExpiresIn;
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new ValidationError('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    const tokens = this.generateTokens({
      userId: user.id as string,
      email: user.email,
    });

    const refreshTokenHash = this.hashToken(tokens.refreshToken);
    await this.userRepository.addRefreshToken(user.id as string, refreshTokenHash);

    logger.info({ userId: user.id }, 'User registered successfully');

    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = this.generateTokens({
      userId: user.id as string,
      email: user.email,
    });

    const refreshTokenHash = this.hashToken(tokens.refreshToken);
    await this.userRepository.addRefreshToken(user.id as string, refreshTokenHash);

    logger.info({ userId: user.id }, 'User logged in successfully');

    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let decoded: JwtPayload & { iat: number; exp: number };

    try {
      decoded = verifyJwt<JwtPayload>(refreshToken, this.jwtRefreshSecret);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const storedTokens = await this.userRepository.getRefreshTokens(decoded.userId);
    const incomingHash = this.hashToken(refreshToken);
    const isTokenStored = storedTokens.includes(incomingHash);

    if (!isTokenStored) {
      // Possible token reuse detected -- clear all stored refresh tokens as a safety measure
      logger.warn({ userId: decoded.userId }, 'Refresh token reuse detected, clearing all sessions');

      for (const tokenHash of storedTokens) {
        await this.userRepository.removeRefreshToken(decoded.userId, tokenHash);
      }

      throw new UnauthorizedError('Refresh token has been revoked');
    }

    // Remove the old refresh token hash
    await this.userRepository.removeRefreshToken(decoded.userId, incomingHash);

    // Generate new token pair
    const tokens = this.generateTokens({
      userId: decoded.userId,
      email: decoded.email,
    });

    const newRefreshTokenHash = this.hashToken(tokens.refreshToken);
    await this.userRepository.addRefreshToken(decoded.userId, newRefreshTokenHash);

    logger.info({ userId: decoded.userId }, 'Tokens refreshed successfully');

    return tokens;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    let decoded: JwtPayload & { iat: number; exp: number };

    try {
      decoded = verifyJwt<JwtPayload>(refreshToken, this.jwtRefreshSecret);
    } catch {
      // Even if the token is expired, attempt to remove it by hash
      const tokenHash = this.hashToken(refreshToken);
      await this.userRepository.removeRefreshToken(userId, tokenHash);
      return;
    }

    // Ensure the token belongs to the requesting user
    if (decoded.userId !== userId) {
      throw new UnauthorizedError('Token does not belong to this user');
    }

    const tokenHash = this.hashToken(refreshToken);
    await this.userRepository.removeRefreshToken(userId, tokenHash);

    logger.info({ userId }, 'User logged out successfully');
  }

  private generateTokens(payload: JwtPayload): AuthTokens {
    const accessToken = signJwt(
      { userId: payload.userId, email: payload.email },
      this.jwtAccessSecret,
      { expiresIn: this.accessExpiresIn },
    );

    const refreshToken = signJwt(
      { userId: payload.userId, email: payload.email },
      this.jwtRefreshSecret,
      { expiresIn: this.refreshExpiresIn },
    );

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
