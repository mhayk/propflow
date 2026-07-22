import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListActivityQueryDto } from './list-activity-query.dto';

describe('ListActivityQueryDto', () => {
  it('defaults the page size to 20', () => {
    expect(new ListActivityQueryDto().limit).toBe(20);
  });

  it('coerces the query-string limit into a number', () => {
    const dto = plainToInstance(ListActivityQueryDto, { limit: '50' });

    expect(dto.limit).toBe(50);
  });

  it('accepts a fully specified query', async () => {
    const dto = plainToInstance(ListActivityQueryDto, {
      limit: '25',
      cursor: '123',
      workOrderId: '55555555-5555-4555-8555-555555555555',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects out-of-range limits and malformed filters', async () => {
    const dto = plainToInstance(ListActivityQueryDto, {
      limit: '0',
      cursor: 'not-a-cursor',
      workOrderId: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'cursor',
      'limit',
      'workOrderId',
    ]);
  });

  it('rejects a non-numeric limit above the cap', async () => {
    const dto = plainToInstance(ListActivityQueryDto, { limit: '101' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('limit');
  });
});
