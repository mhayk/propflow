import { IsEmail, IsString, Length } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(3, 200)
  addressLine1!: string;

  @IsString()
  @Length(1, 100)
  city!: string;

  @IsString()
  @Length(2, 20)
  postcode!: string;

  @IsEmail()
  managerEmail!: string;
}
