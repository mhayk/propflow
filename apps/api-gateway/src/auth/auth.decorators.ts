import {
  createParamDecorator,
  CustomDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

export type UserRole = 'tenant' | 'manager' | 'technician';

export interface AuthenticatedUser {
  /** The user's email — doubles as the JWT subject. */
  sub: string;
  role: UserRole;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Opts a route out of authentication (health probes, login itself). */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given roles; without it, any authenticated
 * user passes — authentication is the default, authorization is opt-in. */
export const Roles = (...roles: UserRole[]): CustomDecorator =>
  SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
      .user,
);
