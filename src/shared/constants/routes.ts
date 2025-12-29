export enum EPrefix {
  V1 = '/api/v1',
}

export enum ERoutes {
  AUTH = `${EPrefix.V1}/auth`,
  USER = `${EPrefix.V1}/user`,
  ROLE = `${EPrefix.V1}/role`,
  VEHICLES = `${EPrefix.V1}/vehicle`,
  DRIVERS = `${EPrefix.V1}/driver`,
  UPLOAD = `${EPrefix.V1}/upload`,
  BOOKINGS = `${EPrefix.V1}/booking`,
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
  lovOrganizations: '/lov/organizations',
};

export const driverRoute = {
  list: '',
  eligible: '/eligible',
  expiredSIM: '/expired-sim',
  findOne: '/:id/detail',
  create: '',
  update: '/:id',
  delete: '/:id',
  restore: '/:id/restore',
};

export const uploadRoute = {
  upload: '',
};

export const bookingRoute = {
  list: '',
  create: '',
  lovAvailableVehicles: '/lov/available-vehicles',
};
