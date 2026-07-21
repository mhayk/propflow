import { Injectable } from '@nestjs/common';
import { Paginated, WorkOrderDto } from '../http/api-types';
import { DownstreamClient } from '../http/downstream.client';

@Injectable()
export class WorkOrdersClient extends DownstreamClient {
  constructor() {
    super(
      process.env.WORK_ORDERS_URL ?? 'http://localhost:3001',
      'work-orders service',
    );
  }

  create(body: unknown): Promise<WorkOrderDto> {
    return this.post('/work-orders', body);
  }

  list(query: Record<string, string>): Promise<Paginated<WorkOrderDto>> {
    const search = new URLSearchParams(query).toString();
    return this.get(`/work-orders${search ? `?${search}` : ''}`);
  }

  getById(id: string): Promise<WorkOrderDto> {
    return this.get(`/work-orders/${id}`);
  }

  assign(id: string, body: unknown): Promise<WorkOrderDto> {
    return this.patch(`/work-orders/${id}/assign`, body);
  }

  updateStatus(id: string, body: unknown): Promise<WorkOrderDto> {
    return this.patch(`/work-orders/${id}/status`, body);
  }
}
