import { Injectable } from '@nestjs/common';
import { ActivityEventDto, CursorPage } from '../http/api-types';
import { DownstreamClient } from '../http/downstream.client';

@Injectable()
export class ActivityClient extends DownstreamClient {
  constructor() {
    super(process.env.AUDIT_URL ?? 'http://localhost:3004', 'audit service');
  }

  list(query: Record<string, string>): Promise<CursorPage<ActivityEventDto>> {
    const search = new URLSearchParams(query).toString();
    return this.get(`/activity${search ? `?${search}` : ''}`);
  }
}
