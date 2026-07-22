import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';
export const USER_ID_HEADER = 'x-user-id';

/**
 * First middleware in the stack (registered with app.use before Nest applies
 * module middleware): accepts an inbound x-request-id or mints one, echoes it
 * on the response, and opens the ALS context every later frame reads from.
 *
 * x-user-id is only honoured on service-to-service hops: the gateway strips
 * nothing (it faces the internet, where the header would be forgeable) — it
 * derives the user from the verified JWT instead, and forwards the header to
 * services, which sit behind the network boundary (k8s NetworkPolicy).
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();

  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const incomingUser = req.headers[USER_ID_HEADER];
  const userId = Array.isArray(incomingUser) ? incomingUser[0] : incomingUser;

  runWithRequestContext({ requestId, userId }, () => next());
}
