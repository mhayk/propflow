import { LoginResponse } from './login-response.dto';

describe('LoginResponse', () => {
  it('carries the access token and role', () => {
    const response = new LoginResponse();
    response.accessToken = 'signed-token';
    response.role = 'manager';

    expect(response).toEqual({ accessToken: 'signed-token', role: 'manager' });
  });
});
