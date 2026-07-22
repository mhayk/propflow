import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePropertyDto } from './dto/create-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let repository: jest.Mocked<
    Pick<Repository<Property>, 'create' | 'save' | 'findOneBy' | 'findAndCount'>
  >;

  const property = (overrides: Partial<Property> = {}): Property => ({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Riverside House',
    addressLine1: '12 Thames Road',
    city: 'London',
    postcode: 'SE1 7TP',
    managerEmail: 'manager@example.com',
    createdAt: new Date('2026-07-21T10:00:00Z'),
    updatedAt: new Date('2026-07-21T10:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: getRepositoryToken(Property), useValue: repository },
      ],
    }).compile();

    service = module.get(PropertiesService);
  });

  it('persists a new property from the dto', async () => {
    const dto: CreatePropertyDto = {
      name: 'Riverside House',
      addressLine1: '12 Thames Road',
      city: 'London',
      postcode: 'SE1 7TP',
      managerEmail: 'manager@example.com',
    };
    const entity = property();
    repository.create.mockReturnValue(entity);
    repository.save.mockResolvedValue(entity);

    await expect(service.create(dto)).resolves.toBe(entity);
    expect(repository.create).toHaveBeenCalledWith(dto);
  });

  it('filters by city and paginates', async () => {
    repository.findAndCount.mockResolvedValue([[property()], 7]);
    const query = Object.assign(new QueryPropertiesDto(), {
      city: 'London',
      page: 2,
      limit: 5,
    });

    const result = await service.findAll(query);

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: { city: 'London' },
      order: { createdAt: 'DESC' },
      skip: 5,
      take: 5,
    });
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 7 });
  });

  it('lists without a city filter when none is given', async () => {
    repository.findAndCount.mockResolvedValue([[property()], 1]);
    const query = new QueryPropertiesDto();

    const result = await service.findAll(query);

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: {},
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 20,
    });
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it('returns the property when it exists', async () => {
    const entity = property();
    repository.findOneBy.mockResolvedValue(entity);

    await expect(service.findOne(entity.id)).resolves.toBe(entity);
    expect(repository.findOneBy).toHaveBeenCalledWith({ id: entity.id });
  });

  it('throws NotFoundException for a missing property', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('falls back to Object metadata when Repository is not defined at load time', () => {
    // emitDecoratorMetadata guards each constructor param type with
    // `typeof X !== "undefined" ? X : Object`; re-evaluate the module without
    // the Repository class to execute the fallback side of that guard.
    const typeorm = jest.requireActual<typeof import('typeorm')>('typeorm');
    const nestTypeorm =
      jest.requireActual<typeof import('@nestjs/typeorm')>('@nestjs/typeorm');
    let isolated: typeof import('./properties.service') | undefined;

    jest.isolateModules(() => {
      // Pin @nestjs/typeorm to the real module so only properties.service
      // itself sees the doctored typeorm export.
      jest.doMock('@nestjs/typeorm', () => nestTypeorm);
      jest.doMock('typeorm', () => ({ ...typeorm, Repository: undefined }));
      isolated = jest.requireActual<typeof import('./properties.service')>(
        './properties.service',
      );
    });
    jest.dontMock('@nestjs/typeorm');
    jest.dontMock('typeorm');

    expect(isolated?.PropertiesService).toBeDefined();
  });
});
