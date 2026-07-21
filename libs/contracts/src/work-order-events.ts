import { EventEnvelope } from './event-envelope';

/** Routing keys under the `work-order.*` namespace on the events exchange. */
export const WORK_ORDER_EVENTS = {
  CREATED: 'work-order.created',
  ASSIGNED: 'work-order.assigned',
  STARTED: 'work-order.started',
  COMPLETED: 'work-order.completed',
  CANCELLED: 'work-order.cancelled',
} as const;

export type WorkOrderEventType =
  (typeof WORK_ORDER_EVENTS)[keyof typeof WORK_ORDER_EVENTS];

export interface WorkOrderEventData {
  workOrderId: string;
  propertyId: string;
  title: string;
  priority: string;
  status: string;
  assigneeId: string | null;
}

export type WorkOrderEvent = EventEnvelope<
  WorkOrderEventType,
  WorkOrderEventData
>;
