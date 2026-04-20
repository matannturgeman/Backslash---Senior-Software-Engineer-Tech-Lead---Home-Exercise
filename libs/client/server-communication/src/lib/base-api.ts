import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

const BASE_URL =
  (typeof process !== 'undefined' && process.env['VITE_API_BASE_URL']) ||
  (typeof process !== 'undefined' && process.env['API_BASE_URL']) ||
  'http://localhost:3000/api';

interface AuthTokenState {
  auth: { token: string | null };
}

interface StorageLike {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
}

function getLocalStorage(): StorageLike | null {
  const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
  return storage ?? null;
}

function readPersistedToken(): string | null {
  return getLocalStorage()?.getItem('accessToken') ?? null;
}

function clearPersistedToken(): void {
  getLocalStorage()?.removeItem('accessToken');
}

export type ApiTagType = 'User' | 'Auth';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const reduxToken = (getState() as AuthTokenState).auth.token;
    const token = reduxToken || readPersistedToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  },
});

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    api.dispatch({ type: 'auth/clearCredentials' });
    clearPersistedToken();
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Auth'] satisfies ApiTagType[],
  endpoints: () => ({}),
});
