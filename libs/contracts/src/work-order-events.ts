import { EventEnvelope } from './event-envelope';

/** Routing keys under the `work-order.*` namespace on the events exchange. */
export const WORK_ORDER_EVENTS = {
  CREATED: 'work-order.created',
  ASSIGNED: 'work-order.assigned',
  STARTED: 'work-order.started',
  COMPLETED: 'work-order.completed',
  CANCELLED: 'work-order.cancelled',
  TRIAGED: 'work-order.triaged',
} as const;

export type WorkOrderEventType =
  (typeof WORK_ORDER_EVENTS)[keyof typeof WORK_ORDER_EVENTS];

/**
 * Closed vocabularies for the LLM triage classification. The model is
 * constrained to these values via a JSON schema, so consumers can rely on
 * them the same way they rely on any other enum in the contract.
 */
export const TRIAGE_CATEGORIES = [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'structural',
  'pest_control',
  'other',
] as const;

export const TRIAGE_URGENCIES = ['emergency', 'high', 'medium', 'low'] as const;

export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];
export type TriageUrgency = (typeof TRIAGE_URGENCIES)[number];

export interface WorkOrderTriage {
  category: TriageCategory;
  urgency: TriageUrgency;
  /** One-sentence justification — kept for auditability of the AI decision. */
  reasoning: string;
}

export interface WorkOrderEventData {
  workOrderId: string;
  propertyId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assigneeId: string | null;
  /** Present on `work-order.triaged` (and later events of a triaged order). */
  triage?: WorkOrderTriage | null;
}

export type WorkOrderEvent = EventEnvelope<
  WorkOrderEventType,
  WorkOrderEventData
>;
