import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  /** Authenticated user (JWT subject), set at the gateway after the token is
   * verified and propagated to services via the x-user-id header. */
  userId?: string;
}

/**
 * AsyncLocalStorage keeps the request context reachable from anywhere on the
 * async call path — service methods, event publishers — without threading a
 * parameter through every signature or resorting to request-scoped providers
 * (which would re-instantiate the whole injection subtree per request).
 */
const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function currentUserId(): string | undefined {
  return storage.getStore()?.userId;
}

/**
 * Authentication happens after the context middleware opened the store (the
 * guard runs later in the request lifecycle), so the user id is attached by
 * mutating the already-open context rather than opening a new one.
 */
export function setCurrentUserId(userId: string): void {
  const store = storage.getStore();
  if (store) store.userId = userId;
}
