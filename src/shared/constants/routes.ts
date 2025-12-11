export enum EPrefix {
  V1 = '/api/v1',
}

export enum ERoutes {
  AUTH = `${EPrefix.V1}/auth`,
  USER = `${EPrefix.V1}/user`,
  ROLE = `${EPrefix.V1}/role`,
}

export const authRoute = {
  register: '/register',
  registerFullForm: '/register/:token',
  login: '/login',
  social: '/login/social',
  verifyOtp: '/verify-otp',
};

export const roleRoute = {
  lov: '/lov',
};
