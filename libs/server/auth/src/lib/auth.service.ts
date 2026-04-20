import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { prisma } from '@libs/server-data-access';
import type {
  AuthResponseDto,
  RegisterDto,
  UserResponseDto,
} from '@libs/shared-dto';
import type { LoggedInUser } from '@libs/server-user';
import {
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from './crypto.util';
import { PasswordResetMailerService } from './password-reset-mailer.service';

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_RESET_TOKEN_TTL_MINUTES = 15;

interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly passwordResetMailer: PasswordResetMailerService) {}

  async verifyToken(token: string): Promise<LoggedInUser> {
    const now = new Date();
    const tokenHash = hashOpaqueToken(token);

    const session = await prisma.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return this.toLoggedInUser(session.user);
  }

  async signToken(user: LoggedInUser, metadata?: SessionMetadata): Promise<string> {
    const rawToken = createOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = new Date(Date.now() + this.sessionTtlSeconds() * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      },
    });

    return rawToken;
  }

  async register(
    dto: RegisterDto,
    metadata?: SessionMetadata,
  ): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email);

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hashPassword(dto.password);
    const name = dto.name.trim();

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return this.issueAuthResponse(user, metadata);
  }

  async login(
    email: string,
    password: string,
    metadata?: SessionMetadata,
  ): Promise<AuthResponseDto> {
    const normalizedEmail = this.normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueAuthResponse(user, metadata);
  }

  async createForgotPasswordToken(email: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return;
    }

    const rawToken = createOpaqueToken();
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = new Date(
      Date.now() + this.resetTokenTtlMinutes() * 60 * 1000,
    );

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    try {
      await this.passwordResetMailer.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token: rawToken,
      });
    } catch (error) {
      await prisma.passwordResetToken.deleteMany({
        where: {
          tokenHash,
          usedAt: null,
        },
      });

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send password reset email to ${user.email}: ${message}`,
      );
    }
  }

  async resetPassword(token: string, nextPassword: string): Promise<void> {
    const now = new Date();
    const tokenHash = hashOpaqueToken(token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(nextPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id },
        },
        data: { usedAt: now },
      }),
      prisma.session.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      }),
    ]);
  }

  async revokeToken(token: string): Promise<void> {
    const tokenHash = hashOpaqueToken(token);

    await prisma.session.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async getUserProfile(userId: number): Promise<UserResponseDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    return this.toUserResponse(user);
  }

  private async issueAuthResponse(
    user: AuthUser,
    metadata?: SessionMetadata,
  ): Promise<AuthResponseDto> {
    const loggedInUser = this.toLoggedInUser(user);
    const accessToken = await this.signToken(loggedInUser, metadata);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.sessionTtlSeconds(),
      user: this.toUserResponse(user),
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toLoggedInUser(user: AuthUser): LoggedInUser {
    return {
      id: user.id,
      email: user.email,
      name: this.displayName(user.name, user.email),
    };
  }

  private toUserResponse(user: AuthUser): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: this.displayName(user.name, user.email),
    };
  }

  private displayName(name: string | null, email: string): string {
    const trimmedName = name?.trim();

    if (trimmedName && trimmedName.length >= 2) {
      return trimmedName;
    }

    const localPart = email.split('@')[0] || 'User';
    return localPart.length >= 2 ? localPart : 'User';
  }

  private sessionTtlSeconds(): number {
    return this.positiveIntEnv(
      'AUTH_SESSION_TTL_SECONDS',
      DEFAULT_SESSION_TTL_SECONDS,
    );
  }

  private resetTokenTtlMinutes(): number {
    return this.positiveIntEnv(
      'AUTH_RESET_TOKEN_TTL_MINUTES',
      DEFAULT_RESET_TOKEN_TTL_MINUTES,
    );
  }

  private positiveIntEnv(key: string, fallback: number): number {
    const raw = process.env[key];

    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    this.logger.warn(
      `Invalid ${key} value "${raw}". Falling back to ${fallback}.`,
    );
    return fallback;
  }
}

