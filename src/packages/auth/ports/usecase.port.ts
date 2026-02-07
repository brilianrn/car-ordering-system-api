import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { ILoginResponse, IRegisterResponse } from '../dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { SearchUserDto } from '../dto/search-user.dto';

export interface ISearchUserResult {
  employeeId: string;
  fullName: string;
  email: string;
  orgUnit: {
    id: number;
    code: string;
    name: string;
  } | null;
}

export interface IVerifyAccountResponse {
  message: string;
}

export interface AuthUsecasePort {
  register(dto: RegisterDto): Promise<IUsecaseResponse<IRegisterResponse>>;

  login(dto: LoginDto): Promise<IUsecaseResponse<ILoginResponse>>;

  searchUsers(dto: SearchUserDto): Promise<IUsecaseResponse<ISearchUserResult[]>>;

  verifyAccount(token: string): Promise<IUsecaseResponse<IVerifyAccountResponse>>;

  ssoLogin(token: string): Promise<IUsecaseResponse<ILoginResponse>>;
}
