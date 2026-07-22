import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class ListActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  /**
   * Keyset cursor: the `nextCursor` returned by the previous page (the
   * bigserial id of its last row). Opaque to clients beyond "pass it back".
   */
  @IsOptional()
  @Matches(/^\d+$/)
  cursor?: string;

  @IsOptional()
  @IsUUID()
  workOrderId?: string;
}
