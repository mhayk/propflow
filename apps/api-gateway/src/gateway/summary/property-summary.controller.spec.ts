import { PropertyDto } from '../http/api-types';
import { PropertySummaryController } from './property-summary.controller';
import {
  PropertySummary,
  PropertySummaryService,
} from './property-summary.service';

describe('PropertySummaryController', () => {
  let controller: PropertySummaryController;
  let summaryService: jest.Mocked<Pick<PropertySummaryService, 'getSummary'>>;

  const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
  const summary: PropertySummary = {
    property: { id: PROPERTY_ID, name: 'Riverside House' } as PropertyDto,
    workOrders: [],
    workOrdersAvailable: true,
  };

  beforeEach(() => {
    summaryService = { getSummary: jest.fn() };
    controller = new PropertySummaryController(
      summaryService as unknown as PropertySummaryService,
    );
  });

  it('delegates getSummary to the service with the id', async () => {
    summaryService.getSummary.mockResolvedValue(summary);

    await expect(controller.getSummary(PROPERTY_ID)).resolves.toBe(summary);
    expect(summaryService.getSummary).toHaveBeenCalledWith(PROPERTY_ID);
  });

  // The emitted design-time metadata guards every referenced type with
  // `typeof X !== "undefined" ? X : Object`; re-evaluating the module with
  // those identifiers absent walks the fallback arms of that emit.
  it('degrades design-time metadata to Object when types are not runtime values', () => {
    const globalRef = globalThis as { Promise?: PromiseConstructor };
    const originalPromise = globalRef.Promise;
    const decoratorFactory = () => (): void => undefined;

    jest.doMock('@nestjs/common', () => ({
      Controller: decoratorFactory,
      Get: decoratorFactory,
      Param: decoratorFactory,
      ParseUUIDPipe: class {},
    }));
    jest.doMock('@nestjs/swagger', () => ({
      ApiBearerAuth: decoratorFactory,
      ApiOkResponse: decoratorFactory,
      ApiOperation: decoratorFactory,
      ApiProperty: decoratorFactory,
      ApiPropertyOptional: decoratorFactory,
      ApiTags: decoratorFactory,
      ApiUnauthorizedResponse: decoratorFactory,
    }));
    jest.doMock('./property-summary.service', () => ({}));

    jest.isolateModules(() => {
      delete globalRef.Promise;
      try {
        const isolated = jest.requireActual<
          typeof import('./property-summary.controller')
        >('./property-summary.controller');
        expect(isolated.PropertySummaryController).toBeDefined();
      } finally {
        globalRef.Promise = originalPromise;
      }
    });

    jest.dontMock('@nestjs/common');
    jest.dontMock('@nestjs/swagger');
    jest.dontMock('./property-summary.service');
  });
});
