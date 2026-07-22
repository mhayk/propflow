import * as typeorm from 'typeorm';
import { AuditEvent } from './audit-event.entity';

describe('AuditEvent', () => {
  it('is a plain data holder for one audit row', () => {
    const row = new AuditEvent();
    row.eventId = '44444444-4444-4444-8444-444444444444';
    row.payload = { title: 'Leaking tap' };

    expect(row).toBeInstanceOf(AuditEvent);
    expect(row.eventId).toBe('44444444-4444-4444-8444-444444444444');
    expect(row.payload).toEqual({ title: 'Leaking tap' });
  });

  it('falls back to Object metadata when design-time types are not constructors', () => {
    const globals = globalThis as { Date: unknown; Record?: unknown };
    const realDate = globals.Date;
    jest.doMock('typeorm', () => typeorm);
    try {
      globals.Date = {};
      globals.Record = function RecordStub(): void {};
      jest.isolateModules(() => {
        const reloaded = jest.requireActual<{ AuditEvent: unknown }>(
          './audit-event.entity',
        );
        expect(typeof reloaded.AuditEvent).toBe('function');
      });
    } finally {
      globals.Date = realDate;
      delete globals.Record;
      jest.dontMock('typeorm');
    }
  });
});
