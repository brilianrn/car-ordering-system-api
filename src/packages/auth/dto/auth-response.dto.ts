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
  sub: string; // Employee ID or Account ID
  email: string;
  roles: string[];
  employeeId: string;
  driverId?: number;
  fullName: string;
}

export interface ISsoCheckToken {
  created_at: string;
  created_by: string;
  department: string;
  division: string;
  email: string;
  full_name: string;
  npk: string;
  number_phone: string;
  photo: string | null;
  photo_url: string | null;
  position: string;
  role_apps: Record<string, boolean>;
  role_apps_status: string;
  role_id: string;
  role_name: string;
  role_user_destination: string;
  role_user_destination_id: string;
  sso_token: string;
  updated_at: string;
  user_type: string;
  username: string;
  vendor_code: string;
  vendor_id: string;
  vendor_name: string;
}
