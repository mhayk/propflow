import { timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, UserRole } from './auth.decorators';

interface DemoUser {
  email: string;
  password: string;
  role: UserRole;
}

/**
 * Demo credential store, seeded from AUTH_USERS ("email:password:role" CSV).
 * A real deployment delegates this to an identity provider (ADR-0008); the
 * seam that matters is that the rest of the system only ever sees the JWT.
 */
const DEFAULT_USERS =
  'manager@propflow.dev:propflow:manager,' +
  'tenant@propflow.dev:propflow:tenant,' +
  'tech@propflow.dev:propflow:technician';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly users: DemoUser[];

  constructor(private readonly jwt: JwtService) {
    this.users = (process.env.AUTH_USERS ?? DEFAULT_USERS)
      .split(',')
      .map((entry) => {
        const [email, password, role] = entry.split(':');
        return { email, password, role: role as UserRole };
      });
    if (!process.env.AUTH_USERS) {
      this.logger.warn('AUTH_USERS not set, using built-in demo users');
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; role: UserRole }> {
    const user = this.users.find(
      (candidate) =>
        candidate.email === email &&
        this.passwordMatches(candidate.password, password),
    );
    if (!user) {
      // One error for both unknown user and wrong password: the response
      // must not reveal which emails exist.
      throw new UnauthorizedException('invalid credentials');
    }

    const payload: AuthenticatedUser = { sub: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      role: user.role,
    };
  }

  /** Constant-time comparison — a plain === leaks the match length/prefix
   * through timing, the classic credential-check mistake. */
  private passwordMatches(expected: string, given: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
