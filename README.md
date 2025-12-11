# Car Ordering System (COS)

## Overview

This repository implements a modular, scalable backend for the **Car Ordering System**, using:

- **NestJS** (API + Worker + Scheduler)
- **Prisma ORM**
- **PostgreSQL**
- **RabbitMQ**
- **Redis**
- **TypeScript**
- **Package-by-Feature Architecture**

---

# Folder Structure (Pattern)

```
src/
  config/
    rabbitmq.ts

  modules/
    auth.module.ts
    rabbitmq.module.ts
    worker.module.ts

  packages/
    auth/
      controller/
      usecase/
      repository/
      dto/
      entity/
      auth.module.ts

  shared/
    constants/
    database/
      prisma/
        schema.prisma
    rabbitmq/
      rabbitmq.service.ts
    redis/
    utils/
      rest-api/
      db.ts
      serialize.ts
      exception-input.ts

  worker/
    main.ts
    order.worker.ts
```

This structure follows the pattern of **Goa Shopee Enabler**, but adapted to **NestJS package-by-feature**.

---

# Application Modes

The system supports **3 runtime modes** via `MODE=`:

## ✅ MODE=api

Runs the main HTTP REST API.

```
npm run prisma:generate
npm run dev
```

## ✅ MODE=worker

Runs background workers that consume RabbitMQ queues:

- Booking processing
- Driver assignment
- Tracking updates
- Audit logging
- Notifications

Run:

```
npm run dev
```

## ✅ MODE=scheduler

---

<!-- # RabbitMQ Exchange + Queue Auto‑Generation

When **worker starts for the first time**, it generates all:

- Exchanges (main + retry)
- Queues (main + retry)
- Bindings

Example naming (NOT copied from Goa Shopee Enabler):

```
COS.ORDER
COS.ORDER.RETRY
COS ORDER QUEUE
COS ORDER QUEUE RETRY
```

This ensures:
- Standardized formats
- Retries are handled
- Routing keys are predictable

---

# Local Development Setup

## 1. Install Dependencies
```
npm install
```

## 2. Setup Environment Variables (`.env`)
```
DATABASE_URL=postgresql://user:password@localhost:5432/cos
REDIS_HOST=localhost
REDIS_PORT=6379

RABBITMQ_URL=amqp://guest:guest@localhost:5672

MODE=api
PORT=3000
```

## 3. Start Prisma
```
npm run prisma:generate
npm run prisma:migrate
```

## 4. Start API
```
npm run dev
```

## 5. Start Worker
```
npm run dev
```

---

# Production Deployment

## 1. Build
```
npm run build
```

## 2. Run API in production
```
MODE=api node dist/main.js
```

## 3. Run Worker in production
```
MODE=worker node dist/worker/main.js
```

## 4. Infrastructure Recommendations
- Use **Docker** or **PM2**
- Use **managed RabbitMQ** (CloudAMQP / AWS MQ)
- Use **managed PostgreSQL** (RDS / Supabase)
- Setup **Redis cluster**
- Enable **TLS** for all external services
- Disable Prisma logs in production

---

# Feature Overview

### AUTH
- Register
- Login
- JWT auth
- Session tracking

### ORDER
- Create & manage orders
- Worker-based processing
- Driver + vehicle linking
- Order history, status logs

### VEHICLE
- CRUD
- Association with customers
- Verification workers

### DRIVER
- License, vendor, availability
- Assignment workflow

### PAYMENT
- Payment records
- Log + audit trail

### AUDIT
- Each request/action stored in `event_logs`

---

# Worker Responsibilities Summary

| Worker | Responsibility |
|--------|---------------|
| OrderWorker | Process orders, validate, push events |
| DriverWorker | Assign drivers automatically |
| VehicleWorker | Validate vehicle readiness |
| TrackingWorker | Trip updates |
| NotificationWorker | Send alerts |
| AuditWorker | Persist logs |

---

# Notes
This system is designed for:

- High throughput
- Asynchronous tasks
- Multi‑module domain separation
- Clean CQRS‑aligned usecase layer
- Future microservice split

---

# License
Proprietary – internal use only. -->
