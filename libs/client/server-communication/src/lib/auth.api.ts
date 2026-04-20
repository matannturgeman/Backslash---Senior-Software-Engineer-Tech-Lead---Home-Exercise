import { baseApi } from './base-api';
import type {
  LoginDto,
  RegisterDto,
  ForgotPasswordRequestDto,
  ResetPasswordDto,
  AuthResponseDto,
  MessageResponseDto,
  SuccessResponseDto,
  UserResponseDto,
} from '@libs/shared-dto';

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<AuthResponseDto, LoginDto>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),

    register: build.mutation<AuthResponseDto, RegisterDto>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    forgotPassword: build.mutation<MessageResponseDto, ForgotPasswordRequestDto>({
      query: (body) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body,
      }),
    }),

    resetPassword: build.mutation<MessageResponseDto, ResetPasswordDto>({
      query: (body) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    logout: build.mutation<SuccessResponseDto, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),

    getMe: build.query<UserResponseDto, void>({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useLogoutMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
} = authApi;
