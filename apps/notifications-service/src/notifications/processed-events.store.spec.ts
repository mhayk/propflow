import { ProcessedEventsStore } from './processed-events.store';

const MAX_ENTRIES = 10_000;

describe('ProcessedEventsStore', () => {
  let store: ProcessedEventsStore;

  beforeEach(() => {
    store = new ProcessedEventsStore();
  });

  it('does not know events it never marked', () => {
    expect(store.has('evt-unknown')).toBe(false);
  });

  it('remembers marked events', () => {
    store.mark('evt-1');

    expect(store.has('evt-1')).toBe(true);
  });

  it('evicts the oldest entry once the capacity is reached', () => {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      store.mark(`evt-${i}`);
    }
    expect(store.has('evt-0')).toBe(true);

    store.mark('evt-overflow');

    expect(store.has('evt-0')).toBe(false);
    expect(store.has('evt-1')).toBe(true);
    expect(store.has(`evt-${MAX_ENTRIES - 1}`)).toBe(true);
    expect(store.has('evt-overflow')).toBe(true);
  });
});
