import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import {
  AuthenticatedUser,
  CurrentUser,
  IS_PUBLIC_KEY,
  Public,
  Roles,
  ROLES_KEY,
} from './auth.decorators';

describe('auth decorators', () => {
  it('Public() marks the target with the isPublic metadata flag', () => {
    class Dummy {}
    Public()(Dummy);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Dummy)).toBe(true);
  });

  it('Roles() records the allowed roles as metadata', () => {
    class Dummy {}
    Roles('manager', 'technician')(Dummy);

    expect(Reflect.getMetadata(ROLES_KEY, Dummy)).toEqual([
      'manager',
      'technician',
    ]);
  });

  it('CurrentUser resolves request.user from the execution context', () => {
    // Nest hides the factory of a param decorator; the established way to
    // reach it is to apply the decorator to a dummy handler and pull the
    // factory back out of the route-arguments metadata.
    class Dummy {
      handler(
        @CurrentUser() user?: AuthenticatedUser,
      ): AuthenticatedUser | undefined {
        return user;
      }
    }
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      Dummy,
      'handler',
    ) as Record<
      string,
      { factory: (data: unknown, context: ExecutionContext) => unknown }
    >;
    const { factory } = metadata[Object.keys(metadata)[0]];

    const user: AuthenticatedUser = {
      sub: 'manager@propflow.dev',
      role: 'manager',
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;

    expect(factory(undefined, context)).toEqual(user);
  });
});
