import { ActivityEventDto, CursorPage } from '../http/api-types';
import { ActivityClient } from './activity.client';

describe('ActivityClient', () => {
  const originalUrl = process.env.AUDIT_URL;
  let client: ActivityClient;
  let fetchMock: jest.Mock;

  const page: CursorPage<ActivityEventDto> = {
    data: [{ id: '42', eventType: 'work-order.created' } as ActivityEventDto],
    nextCursor: null,
  };

  const jsonResponse = (status: number, body: unknown): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  beforeEach(() => {
    delete process.env.AUDIT_URL;
    client = new ActivityClient();
    fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, page));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.AUDIT_URL;
    } else {
      process.env.AUDIT_URL = originalUrl;
    }
  });

  it('targets the configured AUDIT_URL', async () => {
    process.env.AUDIT_URL = 'http://audit:4444';
    const configured = new ActivityClient();

    await configured.list({});

    expect(fetchMock).toHaveBeenCalledWith(
      'http://audit:4444/activity',
      expect.any(Object),
    );
  });

  it('falls back to the local default url', async () => {
    await client.list({});

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3004/activity',
      expect.any(Object),
    );
  });

  it('lists with the query string appended', async () => {
    await expect(client.list({ limit: '20', cursor: '42' })).resolves.toEqual(
      page,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3004/activity?limit=20&cursor=42',
      expect.any(Object),
    );
  });
});
