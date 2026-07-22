import { PropertiesClient } from '../clients/properties.client';
import { Paginated, PropertyDto } from '../http/api-types';
import { PropertiesController } from './properties.controller';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let client: jest.Mocked<
    Pick<PropertiesClient, 'create' | 'list' | 'getById'>
  >;

  const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
  const property = { id: PROPERTY_ID, name: 'Riverside House' } as PropertyDto;
  const page: Paginated<PropertyDto> = {
    data: [property],
    meta: { page: 1, limit: 20, total: 1 },
  };

  beforeEach(() => {
    client = {
      create: jest.fn(),
      list: jest.fn(),
      getById: jest.fn(),
    };
    controller = new PropertiesController(
      client as unknown as PropertiesClient,
    );
  });

  it('delegates create to the client with the raw body', async () => {
    const body = { name: 'Riverside House' };
    client.create.mockResolvedValue(property);

    await expect(controller.create(body)).resolves.toBe(property);
    expect(client.create).toHaveBeenCalledWith(body);
  });

  it('delegates list to the client with the raw query', async () => {
    const query = { page: '1', limit: '20' };
    client.list.mockResolvedValue(page);

    await expect(controller.list(query)).resolves.toBe(page);
    expect(client.list).toHaveBeenCalledWith(query);
  });

  it('delegates getById to the client with the id', async () => {
    client.getById.mockResolvedValue(property);

    await expect(controller.getById(PROPERTY_ID)).resolves.toBe(property);
    expect(client.getById).toHaveBeenCalledWith(PROPERTY_ID);
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
      Body: decoratorFactory,
      Controller: decoratorFactory,
      Get: decoratorFactory,
      Param: decoratorFactory,
      ParseUUIDPipe: class {},
      Post: decoratorFactory,
      Query: decoratorFactory,
    }));
    jest.doMock('@nestjs/swagger', () => ({
      ApiBearerAuth: decoratorFactory,
      ApiBody: decoratorFactory,
      ApiCreatedResponse: decoratorFactory,
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
    jest.doMock('../clients/properties.client', () => ({}));

    jest.isolateModules(() => {
      globalRef.Record = class {};
      delete globalRef.Promise;
      try {
        const isolated = jest.requireActual<
          typeof import('./properties.controller')
        >('./properties.controller');
        expect(isolated.PropertiesController).toBeDefined();
      } finally {
        globalRef.Promise = originalPromise;
        delete globalRef.Record;
      }
    });

    jest.dontMock('@nestjs/common');
    jest.dontMock('@nestjs/swagger');
    jest.dontMock('../../auth/auth.decorators');
    jest.dontMock('../clients/properties.client');
  });
});
