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

  it('skips public routes entirely', () => {
    const guard = guardWith({ isPublic: true, roles: ['manager'] });

    expect(guard.canActivate(context(undefined))).toBe(true);
  });
});
