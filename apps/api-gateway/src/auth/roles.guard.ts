import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  AuthenticatedUser,
  IS_PUBLIC_KEY,
  ROLES_KEY,
  UserRole,
} from './auth.decorators';

/**
 * Authorization, after authentication: routes without @Roles() accept any
 * authenticated user; with it, the JWT's role must be in the list. 401 means
 * "who are you?", 403 means "I know who you are - you can't do this".
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        `requires one of roles: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
