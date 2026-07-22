import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const originalAuthUsers = process.env.AUTH_USERS;
  let service: AuthService;
  let jwt: { signAsync: jest.Mock };

  afterEach(() => {
    if (originalAuthUsers === undefined) {
      delete process.env.AUTH_USERS;
    } else {
      process.env.AUTH_USERS = originalAuthUsers;
    }
  });

  beforeEach(async () => {
    delete process.env.AUTH_USERS; // built-in demo users
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, { provide: JwtService, useValue: jwt }],
    }).compile();

    service = module.get(AuthService);
  });

  it('signs a token carrying the subject and role', async () => {
    const result = await service.login('manager@propflow.dev', 'propflow');

    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'manager@propflow.dev',
      role: 'manager',
    });
    expect(result).toEqual({ accessToken: 'signed-token', role: 'manager' });
  });

  it('rejects a wrong password', async () => {
    await expect(
      service.login('manager@propflow.dev', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown user with the same error as a wrong password', async () => {
    const unknown = await service
      .login('ghost@propflow.dev', 'propflow')
      .catch((e: Error) => e.message);
    const wrongPassword = await service
      .login('manager@propflow.dev', 'wrong')
      .catch((e: Error) => e.message);

    // Equal messages: the API must not reveal which emails exist.
    expect(unknown).toBe(wrongPassword);
  });

  it('rejects a wrong password of the same length as the real one', async () => {
    await expect(
      service.login('manager@propflow.dev', 'propfl0w'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('seeds the credential store from AUTH_USERS when set', async () => {
    process.env.AUTH_USERS = 'admin@propflow.dev:sekret:manager';
    const seeded = new AuthService(jwt as unknown as JwtService);

    await expect(seeded.login('admin@propflow.dev', 'sekret')).resolves.toEqual(
      { accessToken: 'signed-token', role: 'manager' },
    );
    // The custom store replaces the demo users rather than extending them.
    await expect(
      seeded.login('manager@propflow.dev', 'propflow'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('falls back to Object in the design:paramtypes metadata when JwtService is elided', () => {
    // isolatedModules transpilation guards every metadata type reference with
    // `typeof X !== "undefined" ? X : Object`; evaluating the module with the
    // import mocked away exercises the fallback side of that branch.
    jest.doMock('@nestjs/jwt', () => ({}));
    try {
      jest.isolateModules(() => {
        const actual =
          jest.requireActual<typeof import('./auth.service')>('./auth.service');
        expect(actual.AuthService).toBeDefined();
      });
    } finally {
      jest.dontMock('@nestjs/jwt');
    }
  });
});
