import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthResponseDtoSchema,
  ForgotPasswordRequestDtoSchema,
  LoginDtoSchema,
  MessageResponseDtoSchema,
  RegisterDtoSchema,
  ResetPasswordDtoSchema,
  SuccessResponseDtoSchema,
  UserResponseDtoSchema,
  parseDto,
  type AuthResponseDto,
  type MessageResponseDto,
  type SuccessResponseDto,
  type UserResponseDto,
} from '@libs/shared-dto';
import { CurrentUser, type LoggedInUser } from '@libs/server-user';
import { Public } from './auth.decorator';
import { AuthService } from './auth.service';

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email, a password reset link will be sent.';

interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const dto = parseDto(RegisterDtoSchema, body);

    const response = await this.authService.register(
      dto,
      this.getSessionMetadata(request),
    );

    return parseDto(AuthResponseDtoSchema, response);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const dto = parseDto(LoginDtoSchema, body);

    const response = await this.authService.login(
      dto.email,
      dto.password,
      this.getSessionMetadata(request),
    );

    return parseDto(AuthResponseDtoSchema, response);
  }

  @Get('me')
  async getMe(@CurrentUser() user: LoggedInUser): Promise<UserResponseDto> {
    const response = await this.authService.getUserProfile(user.id);
    return parseDto(UserResponseDtoSchema, response);
  }

  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body() body: unknown): Promise<MessageResponseDto> {
    const dto = parseDto(ForgotPasswordRequestDtoSchema, body);
    await this.authService.createForgotPasswordToken(dto.email);

    return parseDto(MessageResponseDtoSchema, {
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    });
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() body: unknown): Promise<MessageResponseDto> {
    const dto = parseDto(ResetPasswordDtoSchema, body);
    await this.authService.resetPassword(dto.token, dto.password);

    return parseDto(MessageResponseDtoSchema, {
      message: 'Password was reset successfully.',
    });
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@Req() request: Request): Promise<SuccessResponseDto> {
    const token = this.extractBearerToken(request);

    if (token) {
      await this.authService.revokeToken(token);
    }

    return parseDto(SuccessResponseDtoSchema, { success: true });
  }

  private getSessionMetadata(request: Request): SessionMetadata {
    const forwardedHeader = request.headers['x-forwarded-for'];
    const forwardedIp =
      typeof forwardedHeader === 'string'
        ? forwardedHeader.split(',')[0]?.trim()
        : undefined;

    const userAgentHeader = request.headers['user-agent'];
    const userAgent =
      typeof userAgentHeader === 'string' ? userAgentHeader : undefined;

    return {
      ipAddress: forwardedIp || request.ip,
      userAgent,
    };
  }

  private extractBearerToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' && token ? token : undefined;
  }
}
