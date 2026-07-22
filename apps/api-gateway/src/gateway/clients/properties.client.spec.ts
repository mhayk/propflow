import { PropertyDto } from '../http/api-types';
import { PropertiesClient } from './properties.client';

describe('PropertiesClient', () => {
  const originalUrl = process.env.PROPERTIES_URL;
  let client: PropertiesClient;
  let fetchMock: jest.Mock;

  const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
  const property = { id: PROPERTY_ID, name: 'Riverside House' } as PropertyDto;

  const jsonResponse = (status: number, body: unknown): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  beforeEach(() => {
    delete process.env.PROPERTIES_URL;
    client = new PropertiesClient();
    fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, property));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.PROPERTIES_URL;
    } else {
      process.env.PROPERTIES_URL = originalUrl;
    }
  });

  it('targets the configured PROPERTIES_URL', async () => {
    process.env.PROPERTIES_URL = 'http://properties:4444';
    const configured = new PropertiesClient();

    await configured.getById(PROPERTY_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://properties:4444/properties/${PROPERTY_ID}`,
      expect.any(Object),
    );
  });

  it('falls back to the local default url', async () => {
    await client.getById(PROPERTY_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3003/properties/${PROPERTY_ID}`,
      expect.any(Object),
    );
  });

  it('creates via POST /properties with the body', async () => {
    const body = { name: 'Riverside House' };

    await expect(client.create(body)).resolves.toEqual(property);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/properties',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  });

  it('lists with the query string appended', async () => {
    await client.list({ page: '2', limit: '10' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/properties?page=2&limit=10',
      expect.any(Object),
    );
  });

  it('lists without a query string when the query is empty', async () => {
    await client.list({});

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/properties',
      expect.any(Object),
    );
  });
});
