import { Test, TestingModule } from '@nestjs/testing';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PaginatedResult } from './dto/paginated-result';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let service: jest.Mocked<
    Pick<PropertiesService, 'create' | 'findAll' | 'findOne'>
  >;

  const property: Property = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Riverside House',
    addressLine1: '12 Thames Road',
    city: 'London',
    postcode: 'SE1 7TP',
    managerEmail: 'manager@example.com',
    createdAt: new Date('2026-07-21T10:00:00Z'),
    updatedAt: new Date('2026-07-21T10:00:00Z'),
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [{ provide: PropertiesService, useValue: service }],
    }).compile();

    controller = module.get(PropertiesController);
  });

  it('delegates creation to the service', async () => {
    const dto: CreatePropertyDto = {
      name: 'Riverside House',
      addressLine1: '12 Thames Road',
      city: 'London',
      postcode: 'SE1 7TP',
      managerEmail: 'manager@example.com',
    };
    service.create.mockResolvedValue(property);

    await expect(controller.create(dto)).resolves.toBe(property);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates listing to the service', async () => {
    const query = Object.assign(new QueryPropertiesDto(), { city: 'London' });
    const page: PaginatedResult<Property> = {
      data: [property],
      meta: { page: 1, limit: 20, total: 1 },
    };
    service.findAll.mockResolvedValue(page);

    await expect(controller.findAll(query)).resolves.toBe(page);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates single lookups to the service', async () => {
    service.findOne.mockResolvedValue(property);

    await expect(controller.findOne(property.id)).resolves.toBe(property);
    expect(service.findOne).toHaveBeenCalledWith(property.id);
  });

  it('falls back to Object metadata when types are not defined at load time', () => {
    // emitDecoratorMetadata guards every serialized type reference (ctor param
    // types, routed-method param types and return types) with
    // `typeof X !== "undefined" ? X : Object`; re-evaluate the module without
    // those globals/classes to execute the fallback side of each guard. All
    // dependencies are captured up front so nothing else evaluates while the
    // Promise global is missing.
    const common =
      jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
    let isolated: typeof import('./properties.controller') | undefined;

    jest.isolateModules(() => {
      jest.doMock('@nestjs/common', () => common);
      jest.doMock('./dto/create-property.dto', () => ({}));
      jest.doMock('./dto/query-properties.dto', () => ({}));
      jest.doMock('./properties.service', () => ({}));
      jest.doMock('./property.entity', () => ({}));
      const globals = globalThis as { Promise?: PromiseConstructor };
      const originalPromise = globals.Promise;
      delete globals.Promise;
      try {
        isolated = jest.requireActual<typeof import('./properties.controller')>(
          './properties.controller',
        );
      } finally {
        globals.Promise = originalPromise;
      }
    });
    jest.dontMock('@nestjs/common');
    jest.dontMock('./dto/create-property.dto');
    jest.dontMock('./dto/query-properties.dto');
    jest.dontMock('./properties.service');
    jest.dontMock('./property.entity');

    expect(isolated?.PropertiesController).toBeDefined();
  });
});
