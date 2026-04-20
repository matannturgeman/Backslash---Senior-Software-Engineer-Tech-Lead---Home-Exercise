/**
 * LoggedInUser
 *
 * Represents the authenticated user payload attached to every inbound request
 * after the JWT has been verified by JwtAuthGuard.
 *
 * This is the shape of `request.user` inside NestJS controllers and middleware.
 * It is intentionally minimal – only the fields that are encoded into the JWT
 * and needed across the server should live here.
 *
 * If you need richer user data (roles, permissions, profile details) add them
 * here AND make sure your AuthService.signToken() encodes them into the JWT.
 */
export interface LoggedInUser {
  /** Database primary key – always present after authentication */
  id: number;

  /** Verified e-mail address of the user */
  email: string;

  /** Display name of the user */
  name: string;
}
