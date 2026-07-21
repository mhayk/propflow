import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
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
