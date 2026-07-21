import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PaginatedResult } from './dto/paginated-result';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { Property } from './property.entity';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly repository: Repository<Property>,
  ) {}

  create(dto: CreatePropertyDto): Promise<Property> {
    return this.repository.save(this.repository.create(dto));
  }

  async findAll(query: QueryPropertiesDto): Promise<PaginatedResult<Property>> {
    const { page, limit, city } = query;

    const where: FindOptionsWhere<Property> = {};
    if (city) where.city = city;

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findOne(id: string): Promise<Property> {
    const property = await this.repository.findOneBy({ id });
    if (!property) {
      throw new NotFoundException(`property ${id} not found`);
    }
    return property;
  }
}
