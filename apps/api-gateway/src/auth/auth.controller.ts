import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public, UserRole } from './auth.decorators';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponse } from './dto/login-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({
    summary: 'Exchange credentials for a JWT',
    description:
      'Public. The returned accessToken (1h expiry) goes on every other request as "Authorization: Bearer <token>".',
  })
  @ApiOkResponse({ type: LoginResponse })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body() dto: LoginDto,
  ): Promise<{ accessToken: string; role: UserRole }> {
    return this.auth.login(dto.email, dto.password);
  }
}
