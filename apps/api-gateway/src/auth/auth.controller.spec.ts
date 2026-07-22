import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  it('delegates login to the AuthService and returns its result', async () => {
    const auth = {
      login: jest
        .fn()
        .mockResolvedValue({ accessToken: 'signed-token', role: 'manager' }),
    };
    const controller = new AuthController(auth as unknown as AuthService);

    const result = await controller.login({
      email: 'manager@propflow.dev',
      password: 'propflow',
    });

    expect(auth.login).toHaveBeenCalledWith('manager@propflow.dev', 'propflow');
    expect(result).toEqual({ accessToken: 'signed-token', role: 'manager' });
  });

  it('falls back to Object in the design metadata when the type imports are elided', () => {
    // isolatedModules transpilation guards every metadata type reference
    // (AuthService, LoginDto, even the global Promise) with
    // `typeof X !== "undefined" ? X : Object`; evaluating the module with all
    // imports mocked away and Promise removed from the global scope exercises
    // the fallback side of those branches.
    const decorator = (): (() => void) => (): void => {};
    jest.doMock('@nestjs/common', () => ({
      Body: decorator,
      Controller: decorator,
      HttpCode: decorator,
      Post: decorator,
    }));
    jest.doMock('@nestjs/swagger', () => ({
      ApiOkResponse: decorator,
      ApiOperation: decorator,
      ApiTags: decorator,
      ApiUnauthorizedResponse: decorator,
    }));
    jest.doMock('./auth.decorators', () => ({ Public: decorator }));
    jest.doMock('./auth.service', () => ({}));
    jest.doMock('./dto/login.dto', () => ({}));
    jest.doMock('./dto/login-response.dto', () => ({}));
    const originalPromise = globalThis.Promise;
    try {
      jest.isolateModules(() => {
        (globalThis as { Promise?: PromiseConstructor }).Promise = undefined;
        const actual =
          jest.requireActual<typeof import('./auth.controller')>(
            './auth.controller',
          );
        expect(actual.AuthController).toBeDefined();
      });
    } finally {
      globalThis.Promise = originalPromise;
      jest.dontMock('@nestjs/common');
      jest.dontMock('@nestjs/swagger');
      jest.dontMock('./auth.decorators');
      jest.dontMock('./auth.service');
      jest.dontMock('./dto/login.dto');
      jest.dontMock('./dto/login-response.dto');
    }
  });
});
