/**
 * Downstream response shapes as the gateway consumes them. Kept minimal and
 * local: the gateway is a client of the services' public APIs, not of their
 * internals. (Generated OpenAPI clients would replace these at scale.)
 */
export interface WorkOrderDto {
  id: string;
  title: string;
  description: string;
  propertyId: string;
  priority: string;
  status: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyDto {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  postcode: string;
  managerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEventDto {
  id: string;
  eventType: string;
  workOrderId: string;
  propertyId: string;
  correlationId: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}
