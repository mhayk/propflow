import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { currentUserId, runWithRequestContext } from '@app/observability';
import { AuthenticatedUser } from './auth.decorators';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  interface FakeRequest {
    path: string;
    headers: { authorization?: string };
    user?: AuthenticatedUser;
  }

  const request = (options: {
    path?: string;
    authorization?: string;
  }): FakeRequest => ({
    path: options.path ?? '/work-orders',
    headers: { authorization: options.authorization },
  });

  const context = (req: FakeRequest): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  let jwt: { verifyAsync: jest.Mock };
  let guardOf: (isPublic?: boolean) => JwtAuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    guardOf = (isPublic?: boolean) => {
      const reflector = {
        getAllAndOverride: jest.fn((): unknown => isPublic),
      } as unknown as Reflector;
      return new JwtAuthGuard(reflector, jwt as unknown as JwtService);
    };
  });

  it('skips @Public routes without touching the token', async () => {
    await expect(guardOf(true).canActivate(context(request({})))).resolves.toBe(
      true,
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('lets Prometheus scrape /metrics and /api/metrics without a JWT', async () => {
    const guard = guardOf();

    await expect(
      guard.canActivate(context(request({ path: '/metrics' }))),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(context(request({ path: '/api/metrics' }))),
    ).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request without an authorization header', async () => {
    await expect(
      guardOf().canActivate(context(request({}))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a non-Bearer scheme', async () => {
    await expect(
      guardOf().canActivate(
        context(request({ authorization: 'Basic dXNlcjpwYXNz' })),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a Bearer header missing its token', async () => {
    await expect(
      guardOf().canActivate(context(request({ authorization: 'Bearer' }))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the payload to the request and the user id to the ALS context', async () => {
    const payload: AuthenticatedUser = {
      sub: 'manager@propflow.dev',
      role: 'manager',
    };
    jwt.verifyAsync.mockResolvedValue(payload);
    const req = request({ authorization: 'Bearer token-123' });

    await runWithRequestContext({ requestId: 'req-1' }, async () => {
      await expect(guardOf().canActivate(context(req))).resolves.toBe(true);
      expect(currentUserId()).toBe('manager@propflow.dev');
    });

    expect(jwt.verifyAsync).toHaveBeenCalledWith('token-123');
    expect(req.user).toEqual(payload);
  });

  it('falls back to Object in the design:paramtypes metadata when the DI imports are elided', () => {
    // isolatedModules transpilation guards every metadata type reference with
    // `typeof X !== "undefined" ? X : Object`; evaluating the module with the
    // imports mocked away exercises the fallback side of those branches.
    jest.doMock('@nestjs/core', () => ({}));
    jest.doMock('@nestjs/jwt', () => ({}));
    try {
      jest.isolateModules(() => {
        const actual =
          jest.requireActual<typeof import('./jwt-auth.guard')>(
            './jwt-auth.guard',
          );
        expect(actual.JwtAuthGuard).toBeDefined();
      });
    } finally {
      jest.dontMock('@nestjs/core');
      jest.dontMock('@nestjs/jwt');
    }
  });

  it('maps a failed verification to 401', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      guardOf().canActivate(
        context(request({ authorization: 'Bearer expired' })),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
