import type { BaseQueryApi } from '@reduxjs/toolkit/query/react';

type PrepareHeaders = (
  headers: { set: (name: string, value: string) => void },
  api: { getState: () => unknown },
) => unknown;

let capturedPrepareHeaders: PrepareHeaders | undefined;

const rawBaseQueryMock = jest.fn();
const fetchBaseQueryMock = jest.fn((options: { prepareHeaders: PrepareHeaders }) => {
  capturedPrepareHeaders = options.prepareHeaders;
  return rawBaseQueryMock;
});

const createApiMock = jest.fn((options: { reducerPath: string }) => ({
  reducerPath: options.reducerPath,
  reducer: jest.fn(),
  middleware: jest.fn(),
  injectEndpoints: jest.fn(),
}));

jest.mock('@reduxjs/toolkit/query/react', () => {
  const actual = jest.requireActual('@reduxjs/toolkit/query/react');

  return {
    ...actual,
    fetchBaseQuery: (options: unknown) => fetchBaseQueryMock(options),
    createApi: (options: unknown) => createApiMock(options),
  };
});

import { baseApi, baseQueryWithReauth } from './base-api';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function mockLocalStorage(initialToken?: string) {
  const store = new Map<string, string>();

  if (initialToken) {
    store.set('accessToken', initialToken);
  }

  const localStorageMock: StorageLike = {
    getItem: jest.fn((key: string) => store.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
    }),
  };

  (globalThis as { localStorage?: StorageLike }).localStorage = localStorageMock;

  return localStorageMock;
}

describe('base-api', () => {
  beforeEach(() => {
    rawBaseQueryMock.mockReset();
    fetchBaseQueryMock.mockClear();
    createApiMock.mockClear();
    delete (globalThis as { localStorage?: StorageLike }).localStorage;
  });

  it('should configure baseApi with expected reducerPath and tags', () => {
    expect(baseApi.reducerPath).toBe('api');
  });

  it('should set Authorization header from redux token first', () => {
    const headers = { set: jest.fn() };
    mockLocalStorage('persisted-token');

    capturedPrepareHeaders?.(headers, {
      getState: () => ({ auth: { token: 'redux-token' } }),
    });

    expect(headers.set).toHaveBeenCalledWith('Authorization', 'Bearer redux-token');
  });

  it('should fall back to persisted token when redux token is missing', () => {
    const headers = { set: jest.fn() };
    mockLocalStorage('persisted-token');

    capturedPrepareHeaders?.(headers, {
      getState: () => ({ auth: { token: null } }),
    });

    expect(headers.set).toHaveBeenCalledWith('Authorization', 'Bearer persisted-token');
  });

  it('should not set Authorization header when token is missing everywhere', () => {
    const headers = { set: jest.fn() };

    capturedPrepareHeaders?.(headers, {
      getState: () => ({ auth: { token: null } }),
    });

    expect(headers.set).not.toHaveBeenCalled();
  });

  it('should clear credentials and persisted token on 401', async () => {
    rawBaseQueryMock.mockResolvedValue({
      error: { status: 401, data: { message: 'Unauthorized' } },
    });

    const localStorage = mockLocalStorage('persisted-token');
    const dispatch = jest.fn();

    await baseQueryWithReauth(
      '/auth/me',
      { dispatch } as unknown as BaseQueryApi,
      {},
    );

    expect(dispatch).toHaveBeenCalledWith({ type: 'auth/clearCredentials' });
    expect(localStorage.removeItem).toHaveBeenCalledWith('accessToken');
  });

  it('should not clear credentials for non-401 errors', async () => {
    rawBaseQueryMock.mockResolvedValue({
      error: { status: 403, data: { message: 'Forbidden' } },
    });

    const localStorage = mockLocalStorage('persisted-token');
    const dispatch = jest.fn();

    await baseQueryWithReauth(
      '/auth/me',
      { dispatch } as unknown as BaseQueryApi,
      {},
    );

    expect(dispatch).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('should handle missing localStorage on 401', async () => {
    rawBaseQueryMock.mockResolvedValue({
      error: { status: 401, data: { message: 'Unauthorized' } },
    });

    const dispatch = jest.fn();

    await expect(
      baseQueryWithReauth('/auth/me', { dispatch } as unknown as BaseQueryApi, {}),
    ).resolves.toEqual({
      error: { status: 401, data: { message: 'Unauthorized' } },
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'auth/clearCredentials' });
  });
});