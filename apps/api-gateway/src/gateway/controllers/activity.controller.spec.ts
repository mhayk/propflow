import { ActivityClient } from '../clients/activity.client';
import { ActivityEventDto, CursorPage } from '../http/api-types';
import { ActivityController } from './activity.controller';

describe('ActivityController', () => {
  let controller: ActivityController;
  let client: jest.Mocked<Pick<ActivityClient, 'list'>>;

  const event = {
    id: '42',
    eventType: 'work-order.created',
  } as ActivityEventDto;
  const page: CursorPage<ActivityEventDto> = {
    data: [event],
    nextCursor: null,
  };

  beforeEach(() => {
    client = { list: jest.fn() };
    controller = new ActivityController(client as unknown as ActivityClient);
  });

  it('delegates list to the client with the raw query', async () => {
    const query = { limit: '20', cursor: '42' };
    client.list.mockResolvedValue(page);

    await expect(controller.list(query)).resolves.toBe(page);
    expect(client.list).toHaveBeenCalledWith(query);
  });

  // The emitted design-time metadata guards every referenced type with
  // `typeof X !== "undefined" ? X : Object`; re-evaluating the module with
  // those identifiers absent (or, for `Record`, present) walks the fallback
  // arms of that emit.
  it('degrades design-time metadata to Object when types are not runtime values', () => {
    const globalRef = globalThis as {
      Promise?: PromiseConstructor;
      Record?: unknown;
    };
    const originalPromise = globalRef.Promise;
    const decoratorFactory = () => (): void => undefined;

    jest.doMock('@nestjs/common', () => ({
      Controller: decoratorFactory,
      Get: decoratorFactory,
      Query: decoratorFactory,
    }));
    jest.doMock('@nestjs/swagger', () => ({
      ApiBearerAuth: decoratorFactory,
      ApiForbiddenResponse: decoratorFactory,
      ApiOkResponse: decoratorFactory,
      ApiOperation: decoratorFactory,
      ApiProperty: decoratorFactory,
      ApiPropertyOptional: decoratorFactory,
      ApiQuery: decoratorFactory,
      ApiTags: decoratorFactory,
      ApiUnauthorizedResponse: decoratorFactory,
    }));
    jest.doMock('../../auth/auth.decorators', () => ({
      Roles: decoratorFactory,
    }));
    jest.doMock('../clients/activity.client', () => ({}));

    jest.isolateModules(() => {
      globalRef.Record = class {};
      delete globalRef.Promise;
      try {
        const isolated = jest.requireActual<
          typeof import('./activity.controller')
        >('./activity.controller');
        expect(isolated.ActivityController).toBeDefined();
      } finally {
        globalRef.Promise = originalPromise;
        delete globalRef.Record;
      }
    });

    jest.dontMock('@nestjs/common');
    jest.dontMock('@nestjs/swagger');
    jest.dontMock('../../auth/auth.decorators');
    jest.dontMock('../clients/activity.client');
  });
});
