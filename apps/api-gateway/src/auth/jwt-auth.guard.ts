import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { setCurrentUserId } from '@app/observability';
import { AuthenticatedUser, IS_PUBLIC_KEY } from './auth.decorators';

/**
 * Global authentication guard: every route requires a Bearer token unless
 * explicitly marked @Public(). On success the payload lands on request.user
 * (for the RolesGuard) and the user id enters the ALS request context, from
 * where the DownstreamClient propagates it — identity travels the same road
 * the correlation id already does.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    // Prometheus scrapes carry no JWT; the metrics route comes from the
    // shared observability lib, out of reach of the @Public() decorator.
    if (request.path === '/metrics' || request.path === '/api/metrics') {
      return true;
    }

    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('missing bearer token');
    }

    try {
      const payload = await this.jwt.verifyAsync<AuthenticatedUser>(token);
      request.user = payload;
      setCurrentUserId(payload.sub);
      return true;
    } catch {
      throw new UnauthorizedException('invalid or expired token');
    }
  }
}
