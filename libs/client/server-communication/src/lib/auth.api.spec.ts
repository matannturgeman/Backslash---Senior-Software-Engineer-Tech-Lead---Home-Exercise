const injectEndpointsMock = jest.fn();
let builtEndpoints: Record<string, unknown> = {};

jest.mock('./base-api', () => ({
  baseApi: {
    injectEndpoints: (config: {
      endpoints: (builder: {
        mutation: (definition: unknown) => unknown;
        query: (definition: unknown) => unknown;
      }) => Record<string, unknown>;
      overrideExisting: boolean;
    }) => {
      injectEndpointsMock(config);
      builtEndpoints = config.endpoints({
        mutation: (definition: unknown) => definition,
        query: (definition: unknown) => definition,
      });

      return {
        endpoints: builtEndpoints,
        useLoginMutation: jest.fn(),
        useRegisterMutation: jest.fn(),
        useForgotPasswordMutation: jest.fn(),
        useResetPasswordMutation: jest.fn(),
        useLogoutMutation: jest.fn(),
        useGetMeQuery: jest.fn(),
        useLazyGetMeQuery: jest.fn(),
      };
    },
  },
}));

import {
  authApi,
  useForgotPasswordMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useResetPasswordMutation,
} from './auth.api';

describe('auth.api', () => {
  it('should inject endpoints without overriding existing ones', () => {
    expect(injectEndpointsMock).toHaveBeenCalledWith(
      expect.objectContaining({ overrideExisting: false }),
    );
    expect(authApi).toBeDefined();
  });

  it('should define login mutation correctly', () => {
    const login = builtEndpoints['login'] as {
      query: (body: unknown) => unknown;
      invalidatesTags: string[];
    };

    expect(login.query({ email: 'a@b.com', password: 'password123' })).toEqual({
      url: '/auth/login',
      method: 'POST',
      body: { email: 'a@b.com', password: 'password123' },
    });
    expect(login.invalidatesTags).toEqual(['Auth']);
  });

  it('should define register mutation correctly', () => {
    const register = builtEndpoints['register'] as {
      query: (body: unknown) => unknown;
      invalidatesTags: string[];
    };

    expect(
      register.query({
        email: 'a@b.com',
        name: 'Alice',
        password: 'password123',
      }),
    ).toEqual({
      url: '/auth/register',
      method: 'POST',
      body: { email: 'a@b.com', name: 'Alice', password: 'password123' },
    });
    expect(register.invalidatesTags).toEqual(['Auth']);
  });

  it('should define forgot password mutation correctly', () => {
    const forgotPassword = builtEndpoints['forgotPassword'] as {
      query: (body: unknown) => unknown;
    };

    expect(forgotPassword.query({ email: 'a@b.com' })).toEqual({
      url: '/auth/forgot-password',
      method: 'POST',
      body: { email: 'a@b.com' },
    });
  });

  it('should define reset password mutation correctly', () => {
    const resetPassword = builtEndpoints['resetPassword'] as {
      query: (body: unknown) => unknown;
      invalidatesTags: string[];
    };

    expect(
      resetPassword.query({ token: 'reset-token', password: 'new-password' }),
    ).toEqual({
      url: '/auth/reset-password',
      method: 'POST',
      body: { token: 'reset-token', password: 'new-password' },
    });
    expect(resetPassword.invalidatesTags).toEqual(['Auth']);
  });

  it('should define logout mutation correctly', () => {
    const logout = builtEndpoints['logout'] as {
      query: () => unknown;
      invalidatesTags: string[];
    };

    expect(logout.query()).toEqual({
      url: '/auth/logout',
      method: 'POST',
    });
    expect(logout.invalidatesTags).toEqual(['Auth']);
  });

  it('should define getMe query correctly', () => {
    const getMe = builtEndpoints['getMe'] as {
      query: () => unknown;
      providesTags: string[];
    };

    expect(getMe.query()).toBe('/auth/me');
    expect(getMe.providesTags).toEqual(['Auth']);
  });

  it('should export generated auth hooks', () => {
    expect(useLoginMutation).toBeDefined();
    expect(useRegisterMutation).toBeDefined();
    expect(useForgotPasswordMutation).toBeDefined();
    expect(useResetPasswordMutation).toBeDefined();
    expect(useLogoutMutation).toBeDefined();
    expect(useGetMeQuery).toBeDefined();
    expect(useLazyGetMeQuery).toBeDefined();
  });
});