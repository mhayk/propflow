import { Injectable } from '@nestjs/common';
import { Paginated, PropertyDto } from '../http/api-types';
import { DownstreamClient } from '../http/downstream.client';

@Injectable()
export class PropertiesClient extends DownstreamClient {
  constructor() {
    super(
      process.env.PROPERTIES_URL ?? 'http://localhost:3003',
      'properties service',
    );
  }

  create(body: unknown): Promise<PropertyDto> {
    return this.post('/properties', body);
  }

  list(query: Record<string, string>): Promise<Paginated<PropertyDto>> {
    const search = new URLSearchParams(query).toString();
    return this.get(`/properties${search ? `?${search}` : ''}`);
  }

  getById(id: string): Promise<PropertyDto> {
    return this.get(`/properties/${id}`);
  }
}
