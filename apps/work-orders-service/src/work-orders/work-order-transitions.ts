import { WorkOrderStatus } from './work-order.enums';

/**
 * Lifecycle: open → assigned → in_progress → completed, with cancellation
 * possible from any non-terminal state. Entering `assigned` is deliberately
 * excluded here — it only happens through assignment, which guarantees an
 * assignee is present (mirroring the DB CHECK constraint).
 */
const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> =
  {
    [WorkOrderStatus.OPEN]: [WorkOrderStatus.CANCELLED],
    [WorkOrderStatus.ASSIGNED]: [
      WorkOrderStatus.IN_PROGRESS,
      WorkOrderStatus.CANCELLED,
    ],
    [WorkOrderStatus.IN_PROGRESS]: [
      WorkOrderStatus.COMPLETED,
      WorkOrderStatus.CANCELLED,
    ],
    [WorkOrderStatus.COMPLETED]: [],
    [WorkOrderStatus.CANCELLED]: [],
  };

export function canTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

const ASSIGNABLE_STATUSES: readonly WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.ASSIGNED, // reassignment is allowed until work starts
];

export function canAssign(status: WorkOrderStatus): boolean {
  return ASSIGNABLE_STATUSES.includes(status);
}
