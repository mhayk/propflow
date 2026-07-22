import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';

describe('CreatePropertyDto', () => {
  const valid = {
    name: 'Riverside House',
    addressLine1: '12 Thames Road',
    city: 'London',
    postcode: 'SE1 7TP',
    managerEmail: 'manager@example.com',
  };

  it('accepts a fully valid payload', async () => {
    const dto = plainToInstance(CreatePropertyDto, valid);

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects out-of-range and malformed fields', async () => {
    const dto = plainToInstance(CreatePropertyDto, {
      name: 'x',
      addressLine1: 'ab',
      city: '',
      postcode: 'a-very-long-postcode-over-limit',
      managerEmail: 'not-an-email',
    });

    const errors = await validate(dto);

    expect(errors.map((e) => e.property).sort()).toEqual([
      'addressLine1',
      'city',
      'managerEmail',
      'name',
      'postcode',
    ]);
  });

  it('rejects non-string values', async () => {
    const dto = plainToInstance(CreatePropertyDto, {
      ...valid,
      name: 42,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isString');
  });
});
