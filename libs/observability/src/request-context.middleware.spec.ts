import type { NextFunction, Request, Response } from 'express';
import { currentRequestId } from './request-context';
import {
  REQUEST_ID_HEADER,
  requestContextMiddleware,
} from './request-context.middleware';

describe('requestContextMiddleware', () => {
  const run = (headers: Record<string, string | string[]>) => {
    const req = { headers } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    let idInsideContext: string | undefined;
    const next: NextFunction = () => {
      idInsideContext = currentRequestId();
    };

    requestContextMiddleware(req, res, next);
    return { req, setHeader, idInsideContext };
  };

  it('mints a request id and exposes it via ALS and the response header', () => {
    const { req, setHeader, idInsideContext } = run({});

    expect(idInsideContext).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.headers[REQUEST_ID_HEADER]).toBe(idInsideContext);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, idInsideContext);
  });

  it('reuses an inbound request id', () => {
    const { idInsideContext } = run({ [REQUEST_ID_HEADER]: 'upstream-id' });

    expect(idInsideContext).toBe('upstream-id');
  });

  it('is undefined outside a request context', () => {
    expect(currentRequestId()).toBeUndefined();
  });
});
