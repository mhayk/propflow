import { WorkOrderDto } from '../http/api-types';
import { WorkOrdersClient } from './work-orders.client';

describe('WorkOrdersClient', () => {
  const originalUrl = process.env.WORK_ORDERS_URL;
  let client: WorkOrdersClient;
  let fetchMock: jest.Mock;

  const WORK_ORDER_ID = '22222222-2222-4222-8222-222222222222';
  const workOrder = { id: WORK_ORDER_ID, status: 'open' } as WorkOrderDto;

  const jsonResponse = (status: number, body: unknown): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  beforeEach(() => {
    delete process.env.WORK_ORDERS_URL;
    client = new WorkOrdersClient();
    fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, workOrder));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.WORK_ORDERS_URL;
    } else {
      process.env.WORK_ORDERS_URL = originalUrl;
    }
  });

  it('targets the configured WORK_ORDERS_URL', async () => {
    process.env.WORK_ORDERS_URL = 'http://work-orders:4444';
    const configured = new WorkOrdersClient();

    await configured.getById(WORK_ORDER_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://work-orders:4444/work-orders/${WORK_ORDER_ID}`,
      expect.any(Object),
    );
  });

  it('falls back to the local default url', async () => {
    await client.getById(WORK_ORDER_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/work-orders/${WORK_ORDER_ID}`,
      expect.any(Object),
    );
  });

  it('creates via POST /work-orders with the body', async () => {
    const body = { title: 'Leaking tap in kitchen' };

    await expect(client.create(body)).resolves.toEqual(workOrder);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/work-orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  });

  it('lists with the query string appended', async () => {
    await client.list({ page: '2', status: 'open' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/work-orders?page=2&status=open',
      expect.any(Object),
    );
  });

  it('lists without a query string when the query is empty', async () => {
    await client.list({});

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/work-orders',
      expect.any(Object),
    );
  });

  it('assigns via PATCH /work-orders/:id/assign', async () => {
    const body = { assigneeId: '33333333-3333-4333-8333-333333333333' };

    await expect(client.assign(WORK_ORDER_ID, body)).resolves.toEqual(
      workOrder,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/work-orders/${WORK_ORDER_ID}/assign`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    );
  });

  it('updates status via PATCH /work-orders/:id/status', async () => {
    const body = { status: 'in_progress' };

    await expect(client.updateStatus(WORK_ORDER_ID, body)).resolves.toEqual(
      workOrder,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/work-orders/${WORK_ORDER_ID}/status`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    );
  });
});
