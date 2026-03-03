export enum EPrefix {
  V1 = '/api/v1',
}

export enum ERoutes {
  AUTH = `${EPrefix.V1}/auth`,
  USER = `${EPrefix.V1}/user`,
  USERS = `${EPrefix.V1}/users`,
  ROLE = `${EPrefix.V1}/role`,
  VEHICLES = `${EPrefix.V1}/vehicle`,
  EMPLOYEES = `${EPrefix.V1}/employees`,
  DRIVERS = `${EPrefix.V1}/driver`,
  UPLOAD = `${EPrefix.V1}/upload`,
  BOOKINGS = `${EPrefix.V1}/booking`,
  COST_VARIABLE = `${EPrefix.V1}/cost-variable`,
  CATEGORY = `${EPrefix.V1}/category`,
  PARAM_SET = `${EPrefix.V1}/params`,
  RBAC = `${EPrefix.V1}/rbac`,
  CARPOOL = `${EPrefix.V1}/carpool`,
  APPROVALS = `${EPrefix.V1}/approvals`,
  ORG_UNIT = `${EPrefix.V1}/org-unit`,
}

export const authRoute = {
  register: '/register',
  registerFullForm: '/register/:token',
  login: '/login',
  social: '/login/social',
  socialLogin: '/login/social',
  ssoLogin: '/sso/login',
  verifyOtp: '/verify-otp',
  verify: '/verify',
  searchUser: '/search-user',
};

export const actionableApprovalRoute = {
  validateToken: '/validate-token',
  execute: '/execute',
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
  update: '/:id',
  findOne: '/:id',
  lovAvailableVehicles: '/lov/available-vehicles',
};

export const tripRoute = {
  base: '/trip',
  detail: '/:id',
};

export const approvalRoute = {
  base: '/approval',
  list: '/list',
  approve: '/:id',
};

export const assignmentRoute = {
  base: '/assignment',
  assign: '/:id',
};

export const executionRoute = {
  base: '/execution',
  checkIn: '/segment/:segmentId/check-in',
  checkOut: '/segment/:segmentId/check-out',
  scanReceipt: '/:executionId/receipt/scan',
  uploadReceipt: '/:executionId/receipt',
  uploadMultipleReceipts: '/:executionId/receipts',
  verifyExecution: '/:executionId/verify',
};

export const costVariableRoute = {
  list: '',
  findOne: '/:id',
  create: '',
  update: '/:id',
  delete: '/:id',
  restore: '/:id/restore',
  lov: '/lov', // List of Values for dropdown (active only)
};

export const paramSetRoute = {
  base: '',
  createDraft: '/draft',
  findActive: '/active',
  list: '',
  findOne: '/:id',
  publish: '/:id/publish',
  rollback: '/:id/rollback',
};

export const financeRoute = {
  base: '/finance',
  verifyItem: '/verify-item',
  verifyBulk: '/verify-bulk',
  closeTrip: '/trip/:executionId/close',
};
