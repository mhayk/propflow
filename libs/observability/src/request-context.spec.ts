import {
  currentRequestId,
  currentUserId,
  runWithRequestContext,
  setCurrentUserId,
} from './request-context';

describe('request context', () => {
  it('exposes the user id inside an open context', () => {
    runWithRequestContext({ requestId: 'req-1', userId: 'user-1' }, () => {
      expect(currentRequestId()).toBe('req-1');
      expect(currentUserId()).toBe('user-1');
    });
  });

  it('returns undefined outside a context', () => {
    expect(currentUserId()).toBeUndefined();
  });

  it('attaches the user id to the already-open context', () => {
    runWithRequestContext({ requestId: 'req-2' }, () => {
      expect(currentUserId()).toBeUndefined();

      setCurrentUserId('user-2');

      expect(currentUserId()).toBe('user-2');
    });
  });

  it('ignores user attachment when no context is open', () => {
    expect(() => setCurrentUserId('user-3')).not.toThrow();
    expect(currentUserId()).toBeUndefined();
  });
});
