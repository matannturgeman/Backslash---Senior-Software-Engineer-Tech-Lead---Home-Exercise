import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PasswordResetMailerService } from './password-reset-mailer.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('PasswordResetMailerService', () => {
  const createTransportMock = nodemailer.createTransport as jest.Mock;
  const sendMailMock = jest.fn();

  let envSnapshot: NodeJS.ProcessEnv;

  beforeEach(() => {
    envSnapshot = { ...process.env };
    jest.clearAllMocks();

    sendMailMock.mockResolvedValue({ messageId: 'msg-1' });
    createTransportMock.mockReturnValue({
      sendMail: sendMailMock,
    });
  });

  afterEach(() => {
    process.env = envSnapshot;
    jest.restoreAllMocks();
  });

  it('warns and skips sending when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    process.env.AUTH_REQUIRE_EMAIL_TRANSPORT = 'false';
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const service = new PasswordResetMailerService();

    await service.sendPasswordResetEmail({
      to: 'user@example.com',
      token: 'token-123',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'SMTP is not configured. Password reset email was not sent.',
    );
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('throws when SMTP is required but not configured', async () => {
    delete process.env.SMTP_HOST;
    process.env.AUTH_REQUIRE_EMAIL_TRANSPORT = 'true';

    const service = new PasswordResetMailerService();

    await expect(
      service.sendPasswordResetEmail({
        to: 'user@example.com',
        token: 'token-123',
      }),
    ).rejects.toThrow('SMTP is not configured');
  });

  it('creates SMTP transport and sends email with escaped name and query token link', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.SMTP_FROM = 'no-reply@example.com';
    process.env.AUTH_RESET_PASSWORD_URL_BASE =
      'https://client.example.com/reset-password';

    const service = new PasswordResetMailerService();

    await service.sendPasswordResetEmail({
      to: 'user@example.com',
      name: '<Jane & Co>',
      token: 'token-123',
    });

    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass',
      },
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@example.com',
        to: 'user@example.com',
        html: expect.stringContaining('Hi &lt;Jane &amp; Co&gt;,'),
      }),
    );

    const sentPayload = sendMailMock.mock.calls[0][0] as { html: string };
    expect(sentPayload.html).toContain('token=token-123');
  });

  it('supports reset URL templates with {token}', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.AUTH_RESET_PASSWORD_URL_BASE =
      'https://client.example.com/reset/{token}';

    const service = new PasswordResetMailerService();

    await service.sendPasswordResetEmail({
      to: 'user@example.com',
      token: 'raw token',
    });

    const sentPayload = sendMailMock.mock.calls[0][0] as { html: string };
    expect(sentPayload.html).toContain(
      'https://client.example.com/reset/raw%20token',
    );
  });

  it('falls back to CLIENT_URL when reset base url is missing', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    delete process.env.AUTH_RESET_PASSWORD_URL_BASE;
    process.env.CLIENT_URL = 'https://client.example.com/reset-password';

    const service = new PasswordResetMailerService();

    await service.sendPasswordResetEmail({
      to: 'user@example.com',
      token: 'token-123',
    });

    const sentPayload = sendMailMock.mock.calls[0][0] as { html: string };
    expect(sentPayload.html).toContain(
      'https://client.example.com/reset-password?token=token-123',
    );
  });

  it('falls back to default reset URL when configured URL is invalid', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.AUTH_RESET_PASSWORD_URL_BASE = 'ht!tp://bad::url';
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const service = new PasswordResetMailerService();

    await service.sendPasswordResetEmail({
      to: 'user@example.com',
      token: 'token-123',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid AUTH_RESET_PASSWORD_URL_BASE/CLIENT_URL'),
    );

    const sentPayload = sendMailMock.mock.calls[0][0] as { html: string };
    expect(sentPayload.html).toContain(
      'http://localhost:4200/reset-password?token=token-123',
    );
  });

  it('falls back SMTP port to default when env value is invalid', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = 'not-a-number';

    new PasswordResetMailerService();

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 587,
      }),
    );
  });

  it('defaults to secure SMTP when port is 465 and secure env is omitted', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    delete process.env.SMTP_SECURE;

    new PasswordResetMailerService();

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: true,
      }),
    );
  });

  it('uses default reset URL when both reset base and client url are missing', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    delete process.env.AUTH_RESET_PASSWORD_URL_BASE;
    delete process.env.CLIENT_URL;

    const service = new PasswordResetMailerService();

    await service.sendPasswordResetEmail({
      to: 'user@example.com',
      token: 'token-xyz',
    });

    const sentPayload = sendMailMock.mock.calls[0][0] as { html: string };
    expect(sentPayload.html).toContain(
      'http://localhost:4200/reset-password?token=token-xyz',
    );
  });
});
