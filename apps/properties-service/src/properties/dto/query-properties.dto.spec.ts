import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryPropertiesDto } from './query-properties.dto';

describe('QueryPropertiesDto', () => {
  it('defaults to the first page of twenty', () => {
    const dto = new QueryPropertiesDto();

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.city).toBeUndefined();
  });

  it('coerces numeric strings from the query string', async () => {
    const dto = plainToInstance(QueryPropertiesDto, {
      city: 'London',
      page: '3',
      limit: '50',
    });

    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects a page below one and a limit above one hundred', async () => {
    const dto = plainToInstance(QueryPropertiesDto, {
      page: '0',
      limit: '101',
    });

    const errors = await validate(dto);

    expect(errors.map((e) => e.property).sort()).toEqual(['limit', 'page']);
  });

  it('rejects an empty city filter', async () => {
    const dto = plainToInstance(QueryPropertiesDto, { city: '' });

    const errors = await validate(dto);

    expect(errors.map((e) => e.property)).toEqual(['city']);
  });
});
