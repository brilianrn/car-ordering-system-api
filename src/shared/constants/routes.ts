export enum EPrefix {
  V1 = '/api/v1',
}

export enum ERoutes {
  AUTH = `${EPrefix.V1}/auth`,
  USER = `${EPrefix.V1}/user`,
  ROLE = `${EPrefix.V1}/role`,
  VEHICLES = `${EPrefix.V1}/vehicle`,
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

export const vehicleRoute = {
  list: '',
  detail: '/:id/detail',
  findOne: '/:id',
  create: '',
  update: '/:id',
  delete: '/:id',
  restore: '/:id/restore',
};
