import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'manager@propflow.dev' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'propflow' })
  @IsString()
  @MinLength(1)
  password!: string;
}
