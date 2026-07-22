import type { NextFunction, Request, Response } from 'express';
import { currentRequestId, currentUserId } from './request-context';
import {
  REQUEST_ID_HEADER,
  requestContextMiddleware,
  USER_ID_HEADER,
} from './request-context.middleware';

describe('requestContextMiddleware', () => {
  const run = (headers: Record<string, string | string[]>) => {
    const req = { headers } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    let idInsideContext: string | undefined;
    let userIdInsideContext: string | undefined;
    const next: NextFunction = () => {
      idInsideContext = currentRequestId();
      userIdInsideContext = currentUserId();
    };

    requestContextMiddleware(req, res, next);
    return { req, setHeader, idInsideContext, userIdInsideContext };
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

  it('takes the first value of a repeated request id header', () => {
    const { idInsideContext } = run({
      [REQUEST_ID_HEADER]: ['first-id', 'second-id'],
    });

    expect(idInsideContext).toBe('first-id');
  });

  it('propagates an inbound user id into the context', () => {
    const { userIdInsideContext } = run({ [USER_ID_HEADER]: 'user-1' });

    expect(userIdInsideContext).toBe('user-1');
  });

  it('takes the first value of a repeated user id header', () => {
    const { userIdInsideContext } = run({
      [USER_ID_HEADER]: ['user-1', 'user-2'],
    });

    expect(userIdInsideContext).toBe('user-1');
  });

  it('leaves the user unset when the header is absent', () => {
    const { userIdInsideContext } = run({});

    expect(userIdInsideContext).toBeUndefined();
  });

  it('is undefined outside a request context', () => {
    expect(currentRequestId()).toBeUndefined();
  });
});
