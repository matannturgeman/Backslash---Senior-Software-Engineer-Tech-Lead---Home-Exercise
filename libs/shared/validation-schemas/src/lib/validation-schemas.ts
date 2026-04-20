import { z } from 'zod';

// ---------------------------------------------------------------------------
// User schemas
// ---------------------------------------------------------------------------

export const userSchema = z.object({
  id: z.number(),
  email: z.string().email('Invalid email address'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),
  createdAt: z.date().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2).max(50),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100),
});

export const updateUserSchema = createUserSchema.partial();

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2).max(50),
  phone: z.string().optional(),
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Invalid reset token'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100),
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  tokenType: z.enum(['Bearer']),
  expiresIn: z.number(),
  user: userSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// ---------------------------------------------------------------------------
// Pagination schema
// ---------------------------------------------------------------------------

export const paginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

// ---------------------------------------------------------------------------
// Common response schemas
// ---------------------------------------------------------------------------

export const messageResponseSchema = z.object({
  message: z.string(),
});

export const successResponseSchema = z.object({
  success: z.literal(true),
});

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  error: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Namespace exports for convenient grouped imports
// ---------------------------------------------------------------------------

export const UserSchemas = {
  user: userSchema,
  create: createUserSchema,
  update: updateUserSchema,
} as const;

export const AuthSchemas = {
  login: loginSchema,
  register: registerSchema,
  forgotPasswordRequest: forgotPasswordRequestSchema,
  resetPassword: resetPasswordSchema,
  response: authResponseSchema,
  refresh: refreshTokenSchema,
} as const;

export const CommonSchemas = {
  messageResponse: messageResponseSchema,
  successResponse: successResponseSchema,
  paginationQuery: paginationQuerySchema,
  errorResponse: errorResponseSchema,
} as const;
