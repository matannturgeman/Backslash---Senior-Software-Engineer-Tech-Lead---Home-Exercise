import { z } from 'zod';
import {
  userSchema,
  createUserSchema,
  loginSchema,
  registerSchema,
  forgotPasswordRequestSchema,
  resetPasswordSchema,
  authResponseSchema,
  messageResponseSchema,
  successResponseSchema,
} from '@libs/shared-validation-schemas';

// ---------------------------------------------------------------------------
// User DTOs
// ---------------------------------------------------------------------------

export const CreateUserDtoSchema = createUserSchema;
export const UpdateUserDtoSchema = userSchema
  .omit({ id: true, createdAt: true })
  .partial();
export const UserResponseDtoSchema = userSchema;

export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;
export type UserResponseDto = z.infer<typeof UserResponseDtoSchema>;

// ---------------------------------------------------------------------------
// Auth DTOs
// ---------------------------------------------------------------------------

export const LoginDtoSchema = loginSchema;
export const RegisterDtoSchema = registerSchema;
export const ForgotPasswordRequestDtoSchema = forgotPasswordRequestSchema;
export const ResetPasswordDtoSchema = resetPasswordSchema;
export const AuthResponseDtoSchema = authResponseSchema;

export type LoginDto = z.infer<typeof LoginDtoSchema>;
export type RegisterDto = z.infer<typeof RegisterDtoSchema>;
export type ForgotPasswordRequestDto = z.infer<typeof ForgotPasswordRequestDtoSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;
export type AuthResponseDto = z.infer<typeof AuthResponseDtoSchema>;

// ---------------------------------------------------------------------------
// Common response DTOs
// ---------------------------------------------------------------------------

export const MessageResponseDtoSchema = messageResponseSchema;
export const SuccessResponseDtoSchema = successResponseSchema;

export type MessageResponseDto = z.infer<typeof MessageResponseDtoSchema>;
export type SuccessResponseDto = z.infer<typeof SuccessResponseDtoSchema>;

// ---------------------------------------------------------------------------
// Pagination DTOs
// ---------------------------------------------------------------------------

export const PaginationQueryDtoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedResponseDtoSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });

export type PaginationQueryDto = z.infer<typeof PaginationQueryDtoSchema>;
export type PaginatedResponseDto<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse and validate an unknown value against a DTO schema.
 * Throws a ZodError on invalid input.
 *
 * @example
 * const dto = parseDto(LoginDtoSchema, req.body);
 */
export function parseDto<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safe-parse an unknown value against a DTO schema.
 * Returns a Zod safe-parse result - never throws.
 */
export function safeParsDto<T extends z.ZodTypeAny>(schema: T, data: unknown) {
  // Return type intentionally inferred - Zod v4's safeParse generics are
  // complex and an explicit annotation causes TS2322 under strict mode.
  return schema.safeParse(data);
}
