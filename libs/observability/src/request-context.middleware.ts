import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * First middleware in the stack (registered with app.use before Nest applies
 * module middleware): accepts an inbound x-request-id or mints one, echoes it
 * on the response, and opens the ALS context every later frame reads from.
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

  runWithRequestContext({ requestId }, () => next());
}
