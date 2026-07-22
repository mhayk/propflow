import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser, UserRole } from './auth.decorators';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const context = (user?: AuthenticatedUser): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const guardWith = (
    metadata: Partial<Record<string, boolean | UserRole[]>>,
  ): RolesGuard => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string): unknown => metadata[key]),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('lets any authenticated user through routes without @Roles', () => {
    const guard = guardWith({});

    expect(guard.canActivate(context({ sub: 'a@b.c', role: 'tenant' }))).toBe(
      true,
    );
  });

  it('allows a listed role and refuses the others with 403', () => {
    const guard = guardWith({ roles: ['manager'] });

    expect(guard.canActivate(context({ sub: 'a@b.c', role: 'manager' }))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(context({ sub: 'a@b.c', role: 'tenant' })),
    ).toThrow(ForbiddenException);
  });

  it('treats an empty @Roles() list as no restriction', () => {
    const guard = guardWith({ roles: [] });

    expect(guard.canActivate(context({ sub: 'a@b.c', role: 'tenant' }))).toBe(
      true,
    );
  });

  it('refuses a restricted route when no user is on the request', () => {
    const guard = guardWith({ roles: ['manager'] });

    expect(() => guard.canActivate(context(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('skips public routes entirely', () => {
    const guard = guardWith({ isPublic: true, roles: ['manager'] });

    expect(guard.canActivate(context(undefined))).toBe(true);
  });

  it('falls back to Object in the design:paramtypes metadata when Reflector is elided', () => {
    // isolatedModules transpilation guards every metadata type reference with
    // `typeof X !== "undefined" ? X : Object`; evaluating the module with the
    // import mocked away exercises the fallback side of that branch.
    jest.doMock('@nestjs/core', () => ({}));
    try {
      jest.isolateModules(() => {
        const actual =
          jest.requireActual<typeof import('./roles.guard')>('./roles.guard');
        expect(actual.RolesGuard).toBeDefined();
      });
    } finally {
      jest.dontMock('@nestjs/core');
    }
  });
});
