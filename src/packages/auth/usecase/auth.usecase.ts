import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { SearchUserDto } from '../dto/search-user.dto';
import { AuthRepository } from '../repository/auth.repository';

@Injectable()
export class AuthUseCase {
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
  ) {}

  // =========================================
  // REGISTER
  // =========================================
  async register(dto: RegisterDto) {
    const exists = await this.repo.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already exists');

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.repo.createUser({
      name: dto.name,
      email: dto.email,
      password: hashed,
      role: 'USER',
    });

    return {
      message: 'Registration success',
      user,
    };
  }

  // =========================================
  // LOGIN
  // =========================================
  async login(dto: LoginDto) {
    // const user = await this.repo.findByEmail(dto.email);
    // if (!user) throw new UnauthorizedException('Invalid email or password');
    // const valid = await bcrypt.compare(dto.password, user.email);
    // if (!valid) throw new UnauthorizedException('Invalid email or password');
    // const accessToken = await this.jwt.signAsync({
    //   sub: user.id,
    //   email: user.email,
    //   role: user.role,
    // });
    // return {
    //   message: 'Login success',
    //   accessToken,
    // };
  }

  // =========================================
  // SEARCH USER
  // =========================================
  async searchUsers(dto: SearchUserDto) {
    const users = await this.repo.searchUsers({
      query: dto.query,
      employeeId: dto.employeeId,
      email: dto.email,
      fullName: dto.fullName,
      limit: 50,
    });

    return {
      message: 'Search users success',
      data: users,
    };
  }
}
