import { Injectable, Logger } from '@nestjs/common';
import { PropertiesClient } from '../clients/properties.client';
import { WorkOrdersClient } from '../clients/work-orders.client';
import { PropertyDto, WorkOrderDto } from '../http/api-types';

export interface PropertySummary {
  property: PropertyDto;
  workOrders: WorkOrderDto[] | null;
  /** false when the work-orders service could not be reached — partial data,
   * not an error: the property itself is the primary resource here. */
  workOrdersAvailable: boolean;
}

@Injectable()
export class PropertySummaryService {
  private readonly logger = new Logger(PropertySummaryService.name);

  constructor(
    private readonly properties: PropertiesClient,
    private readonly workOrders: WorkOrdersClient,
  ) {}

  async getSummary(propertyId: string): Promise<PropertySummary> {
    // Fan out in parallel: the two calls are independent, so latency is
    // max(a, b) instead of a + b.
    const [property, workOrders] = await Promise.all([
      // Primary resource: failures (404 included) propagate to the caller.
      this.properties.getById(propertyId),
      // Enrichment: degrade to null instead of failing the whole response.
      this.workOrders.list({ propertyId, limit: '50' }).catch((error) => {
        this.logger.warn(
          `work orders unavailable for summary of ${propertyId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }),
    ]);

    return {
      property,
      workOrders: workOrders?.data ?? null,
      workOrdersAvailable: workOrders !== null,
    };
  }
}
