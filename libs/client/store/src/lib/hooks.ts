import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './store';

/**
 * Typed version of `useDispatch` bound to this store's AppDispatch type.
 *
 * Use this instead of the plain `useDispatch` hook to get full type-safety
 * when dispatching actions and thunks.
 *
 * @example
 * const dispatch = useAppDispatch();
 * dispatch(setCredentials({ user, token }));
 */
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();

/**
 * Typed version of `useSelector` bound to this store's RootState type.
 *
 * Use this instead of the plain `useSelector` hook so you never have to
 * manually annotate the state parameter in your selector functions.
 *
 * @example
 * const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
 * const user = useAppSelector((state) => state.auth.user);
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
