export interface ILoginResponse {
  accessToken: string;
  user: {
    employeeId: string;
    email: string;
    fullName: string;
    roles: string[];
  };
}

export interface IRegisterResponse {
  message: string;
  email: string;
}

export interface IJwtPayload {
  sub: string; // Employee ID
  email: string;
  roles: string[];
  employeeId: string;
}
