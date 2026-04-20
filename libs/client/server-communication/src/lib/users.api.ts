import { baseApi } from './base-api';
import type {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  PaginationQueryDto,
  PaginatedResponseDto,
} from '@libs/shared-dto';

// ---------------------------------------------------------------------------
// Users API slice — injected into baseApi
// ---------------------------------------------------------------------------

/**
 * Users CRUD endpoints injected into the root `baseApi`.
 *
 * Provides hooks for:
 *  - `useGetUsersQuery`        — GET    /users          (paginated list)
 *  - `useLazyGetUsersQuery`    — same as above but fires only when called
 *  - `useGetUserByIdQuery`     — GET    /users/:id
 *  - `useLazyGetUserByIdQuery` — same as above but fires only when called
 *  - `useCreateUserMutation`   — POST   /users
 *  - `useUpdateUserMutation`   — PATCH  /users/:id
 *  - `useDeleteUserMutation`   — DELETE /users/:id
 *
 * ### Cache invalidation strategy
 * - Individual user queries are tagged `{ type: 'User', id }`.
 * - The list query is tagged `{ type: 'User', id: 'LIST' }`.
 * - Create invalidates the whole list so the new entry appears.
 * - Update/Delete invalidate the individual item tag AND the list so
 *   stale data is never shown.
 *
 * ### Usage example
 * ```tsx
 * import {
 *   useGetUsersQuery,
 *   useCreateUserMutation,
 * } from '@libs/client-server-communication';
 *
 * function UserList() {
 *   const { data, isLoading } = useGetUsersQuery({ page: 1, limit: 20 });
 *   const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {data?.data.map((user) => <UserRow key={user.id} user={user} />)}
 *     </>
 *   );
 * }
 * ```
 */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ── GET /users ─────────────────────────────────────────────────────────
    /**
     * Fetches a paginated list of users.
     *
     * Pass `page` and `limit` to control pagination.  The result is cached
     * per unique `{ page, limit }` argument combination.
     *
     * @example
     * const { data } = useGetUsersQuery({ page: 1, limit: 20 });
     * // data.data    → UserResponseDto[]
     * // data.total   → total number of records
     * // data.totalPages → total number of pages
     */
    getUsers: build.query<PaginatedResponseDto<UserResponseDto>, PaginationQueryDto>({
      query: ({ page = 1, limit = 20 }) => ({
        url: '/users',
        params: { page, limit },
      }),
      providesTags: (result) =>
        result
          ? [
              // Tag each individual user so targeted invalidation works
              ...result.data.map(({ id }) => ({ type: 'User' as const, id })),
              // Tag the whole list so create/bulk-delete can bust the cache
              { type: 'User' as const, id: 'LIST' },
            ]
          : [{ type: 'User' as const, id: 'LIST' }],
    }),

    // ── GET /users/:id ─────────────────────────────────────────────────────
    /**
     * Fetches a single user by their numeric ID.
     *
     * The result is cached with a per-id tag so it is automatically
     * re-fetched when the same user is mutated via `updateUser` or removed
     * via `deleteUser`.
     *
     * @example
     * const { data: user, isLoading } = useGetUserByIdQuery(42);
     */
    getUserById: build.query<UserResponseDto, number>({
      query: (id) => `/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'User' as const, id }],
    }),

    // ── POST /users ────────────────────────────────────────────────────────
    /**
     * Creates a new user.
     *
     * Invalidates the `LIST` tag so any rendered user list automatically
     * re-fetches and shows the newly created entry.
     *
     * @example
     * const [createUser, { isLoading }] = useCreateUserMutation();
     * await createUser({ email: 'alice@example.com', name: 'Alice', password: 'secret' }).unwrap();
     */
    createUser: build.mutation<UserResponseDto, CreateUserDto>({
      query: (body) => ({
        url: '/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'User' as const, id: 'LIST' }],
    }),

    // ── PATCH /users/:id ───────────────────────────────────────────────────
    /**
     * Partially updates an existing user.
     *
     * Invalidates both the individual user tag and the list tag so that
     * all views showing this user reflect the latest data.
     *
     * @example
     * const [updateUser] = useUpdateUserMutation();
     * await updateUser({ id: 42, body: { name: 'Bob' } }).unwrap();
     */
    updateUser: build.mutation<UserResponseDto, { id: number; body: UpdateUserDto }>({
      query: ({ id, body }) => ({
        url: `/users/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'User' as const, id },
        { type: 'User' as const, id: 'LIST' },
      ],
    }),

    // ── DELETE /users/:id ──────────────────────────────────────────────────
    /**
     * Deletes a user by ID.
     *
     * Invalidates both the individual tag and the list tag so any
     * rendered list removes the deleted entry immediately.
     *
     * @example
     * const [deleteUser] = useDeleteUserMutation();
     * await deleteUser(42).unwrap();
     */
    deleteUser: build.mutation<void, number>({
      query: (id) => ({
        url: `/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'User' as const, id },
        { type: 'User' as const, id: 'LIST' },
      ],
    }),
  }),
  overrideExisting: false,
});

// ---------------------------------------------------------------------------
// Auto-generated hooks — re-exported from the lib index for convenience
// ---------------------------------------------------------------------------

export const {
  useGetUsersQuery,
  useLazyGetUsersQuery,
  useGetUserByIdQuery,
  useLazyGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = usersApi;
