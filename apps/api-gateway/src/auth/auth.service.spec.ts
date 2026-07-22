import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwt: { signAsync: jest.Mock };

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
});
