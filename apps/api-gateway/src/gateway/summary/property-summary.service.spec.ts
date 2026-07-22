import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesClient } from '../clients/properties.client';
import { WorkOrdersClient } from '../clients/work-orders.client';
import { PropertyDto, WorkOrderDto } from '../http/api-types';
import { PropertySummaryService } from './property-summary.service';

describe('PropertySummaryService', () => {
  let service: PropertySummaryService;
  let properties: { getById: jest.Mock };
  let workOrders: { list: jest.Mock };

  const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
  const property = { id: PROPERTY_ID, name: 'Riverside House' } as PropertyDto;
  const workOrder = { id: 'wo-1', propertyId: PROPERTY_ID } as WorkOrderDto;

  beforeEach(async () => {
    properties = { getById: jest.fn() };
    workOrders = { list: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertySummaryService,
        { provide: PropertiesClient, useValue: properties },
        { provide: WorkOrdersClient, useValue: workOrders },
      ],
    }).compile();

    service = module.get(PropertySummaryService);
  });

  it('composes the property with its work orders', async () => {
    properties.getById.mockResolvedValue(property);
    workOrders.list.mockResolvedValue({
      data: [workOrder],
      meta: { page: 1, limit: 50, total: 1 },
    });

    const summary = await service.getSummary(PROPERTY_ID);

    expect(summary).toEqual({
      property,
      workOrders: [workOrder],
      workOrdersAvailable: true,
    });
  });

  it('degrades gracefully when the work-orders service is down', async () => {
    properties.getById.mockResolvedValue(property);
    workOrders.list.mockRejectedValue(new Error('502'));

    const summary = await service.getSummary(PROPERTY_ID);

    expect(summary.property).toBe(property);
    expect(summary.workOrders).toBeNull();
    expect(summary.workOrdersAvailable).toBe(false);
  });

  it('degrades gracefully on a non-Error work-orders failure', async () => {
    properties.getById.mockResolvedValue(property);
    workOrders.list.mockRejectedValue('socket hang up');

    const summary = await service.getSummary(PROPERTY_ID);

    expect(summary.property).toBe(property);
    expect(summary.workOrders).toBeNull();
    expect(summary.workOrdersAvailable).toBe(false);
  });

  it('propagates a missing property (the primary resource)', async () => {
    properties.getById.mockRejectedValue(new NotFoundException());
    workOrders.list.mockResolvedValue({ data: [], meta: {} });

    await expect(service.getSummary(PROPERTY_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // The emitted design-time metadata guards every referenced type with
  // `typeof X !== "undefined" ? X : Object`; re-evaluating the module with
  // the client classes absent walks the fallback arms of that emit.
  it('degrades design-time metadata to Object when types are not runtime values', () => {
    const decoratorFactory = () => (): void => undefined;

    jest.doMock('@nestjs/common', () => ({
      Injectable: decoratorFactory,
      Logger: class {},
    }));
    jest.doMock('../clients/properties.client', () => ({}));
    jest.doMock('../clients/work-orders.client', () => ({}));

    jest.isolateModules(() => {
      const isolated = jest.requireActual<
        typeof import('./property-summary.service')
      >('./property-summary.service');
      expect(isolated.PropertySummaryService).toBeDefined();
    });

    jest.dontMock('@nestjs/common');
    jest.dontMock('../clients/properties.client');
    jest.dontMock('../clients/work-orders.client');
  });
});
