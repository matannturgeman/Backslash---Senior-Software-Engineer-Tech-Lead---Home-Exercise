import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';
import { PasswordResetMailerService } from './password-reset-mailer.service';

/**
 * AuthModule
 *
 * Registers the JwtAuthGuard globally so every route is protected by default.
 * Mark individual routes or controllers as public with the @Public() decorator.
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetMailerService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}

