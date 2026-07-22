import { Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const DEV_SECRET = 'dev-secret-change-me';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    new Logger('AuthModule').warn(
      'JWT_SECRET not set, using the development secret',
    );
  }
  return secret ?? DEV_SECRET;
}

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret(),
      // Short-lived access tokens; no refresh flow at this scale (ADR-0008).
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Registration order matters: authentication runs before authorization.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
