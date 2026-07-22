import { ApiProperty } from '@nestjs/swagger';

export class LoginResponse {
  @ApiProperty({ description: 'JWT — send as Authorization: Bearer <token>' })
  accessToken!: string;

  @ApiProperty({ enum: ['tenant', 'manager', 'technician'] })
  role!: string;
}
