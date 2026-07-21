/**
 * Broker topology shared by every service. Producers and consumers import
 * these names instead of repeating strings, so a rename is a compile-time
 * refactor rather than a silently broken binding.
 */
export const EXCHANGES = {
  /** Topic exchange all domain events are published to. */
  EVENTS: 'propflow.events',
  /** Messages that exhausted their retries end up here. */
  DEAD_LETTER: 'propflow.dlx',
} as const;
