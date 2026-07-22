import { WorkOrderTriage } from '@app/contracts';

export interface TriageInput {
  title: string;
  description: string;
  priority: string;
}

/**
 * Boundary between the domain and the LLM provider, mirroring the
 * NotificationSender pattern: the consumer depends on this abstraction, tests
 * substitute it, and swapping providers touches exactly one class.
 *
 * `null` means "no classification available" (missing key, API failure,
 * refusal) — triage is advisory, so absence is a valid outcome, not an error.
 */
export abstract class TriageClassifier {
  abstract classify(input: TriageInput): Promise<WorkOrderTriage | null>;
}
