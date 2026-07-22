import { Injectable } from '@nestjs/common';

const MAX_ENTRIES = 10_000;

/**
 * Consumer-side idempotency: remembers which eventIds were fully processed so
 * an at-least-once redelivery doesn't send the same notification twice.
 *
 * In-memory on purpose — one instance, bounded, zero infrastructure. The
 * documented production upgrade is a shared store (Redis SETNX or a DB unique
 * insert, as the audit projection already does); the seam stays the same.
 */
@Injectable()
export class ProcessedEventsStore {
  private readonly seen = new Set<string>();

  has(eventId: string): boolean {
    return this.seen.has(eventId);
  }

  /** Call only after the side effect succeeded — marking first would turn a
   * crash between mark and send into a silently lost notification. */
  mark(eventId: string): void {
    if (this.seen.size >= MAX_ENTRIES) {
      // Sets iterate in insertion order, so the first entry is the oldest.
      for (const oldest of this.seen) {
        this.seen.delete(oldest);
        break;
      }
    }
    this.seen.add(eventId);
  }
}
