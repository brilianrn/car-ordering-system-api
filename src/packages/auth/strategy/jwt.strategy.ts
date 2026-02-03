import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IJwtPayload } from '../dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: IJwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return user data to be attached to request.user
    return {
      employeeId: payload.employeeId,
      email: payload.email,
      roles: payload.roles || [],
      sub: payload.sub,
    };
  }
}
