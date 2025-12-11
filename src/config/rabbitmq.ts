export const RMQ = {
  ORDER: {
    exchange: 'cos-order',
    retryExchange: 'cos-order-retry',
    queue: 'COS ORDER PROCESSING',
    retryQueue: 'COS ORDER PROCESSING RETRY',
    routingKey: 'order.process',
  },
  DRIVER_ASSIGN: {
    exchange: 'cos-driver-assign',
    retryExchange: 'cos-driver-assign-retry',
    queue: 'COS DRIVER ASSIGNMENT',
    retryQueue: 'COS DRIVER ASSIGNMENT RETRY',
    routingKey: 'driver.assign',
  },
  VEHICLE_CHECK: {
    exchange: 'cos-vehicle-check',
    retryExchange: 'cos-vehicle-check-retry',
    queue: 'COS VEHICLE AVAILABILITY',
    retryQueue: 'COS VEHICLE AVAILABILITY RETRY',
    routingKey: 'vehicle.check',
  },
  TRACKING: {
    exchange: 'cos-tracking',
    retryExchange: 'cos-tracking-retry',
    queue: 'COS TRIP TRACKING',
    retryQueue: 'COS TRIP TRACKING RETRY',
    routingKey: 'tracking.update',
  },
  NOTIFICATION: {
    exchange: 'cos-notification',
    retryExchange: 'cos-notification-retry',
    queue: 'COS NOTIFICATION',
    retryQueue: 'COS NOTIFICATION RETRY',
    routingKey: 'notification.send',
  },
  AUDIT: {
    exchange: 'cos-audit',
    retryExchange: 'cos-audit-retry',
    queue: 'COS AUDIT LOG',
    retryQueue: 'COS AUDIT LOG RETRY',
    routingKey: 'audit.log',
  },
};
