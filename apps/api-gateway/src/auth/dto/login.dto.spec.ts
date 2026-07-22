import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a well-formed payload', async () => {
    const dto = new LoginDto();
    dto.email = 'manager@propflow.dev';
    dto.password = 'propflow';

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects a malformed email and an empty password', async () => {
    const dto = new LoginDto();
    dto.email = 'not-an-email';
    dto.password = '';

    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'email',
      'password',
    ]);
  });
});
