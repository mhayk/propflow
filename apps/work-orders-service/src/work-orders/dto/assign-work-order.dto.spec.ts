import { validate } from 'class-validator';
import { AssignWorkOrderDto } from './assign-work-order.dto';

const build = (assigneeId: unknown): AssignWorkOrderDto =>
  Object.assign(new AssignWorkOrderDto(), { assigneeId });

describe('AssignWorkOrderDto', () => {
  it('accepts a UUID assignee', async () => {
    await expect(
      validate(build('5b4f2a54-0000-4000-8000-000000000009')),
    ).resolves.toHaveLength(0);
  });

  it.each([
    ['a non-UUID assignee', 'tech-42'],
    ['a missing assignee', undefined],
  ])('rejects %s', async (_name, assigneeId) => {
    const errors = await validate(build(assigneeId));

    expect(errors.length).toBeGreaterThan(0);
  });
});
