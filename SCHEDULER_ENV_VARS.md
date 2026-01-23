# Scheduler Environment Variables Documentation

## Scheduler Mode Configuration

The Car Ordering System supports three operational modes:
- **API**: Main REST API server (default)
- **WORKER**: Background job processing
- **SCHEDULER**: Automated data synchronization jobs

## Required Environment Variables for Scheduler Mode

### Application Mode
```bash
MODE=SCHEDULER
PORT=3003  # Must be 3003 for scheduler mode
```

### HRIS Integration (MSA API)
```bash
# HRIS API Configuration
HRIS_API_BASE_URL="https://msa-be.dharmagroup.co.id/api/v1"
HRIS_API_KEY="your-hris-api-key-here"
HRIS_API_TIMEOUT=30000  # milliseconds
HRIS_API_RETRY_ATTEMPTS=3

# Rate Limiting
HRIS_RATE_LIMIT_REQUESTS=100  # requests per period
HRIS_RATE_LIMIT_PERIOD=60000  # milliseconds (1 minute)
```

### Scheduler Configuration
```bash
# Cron Schedule (runs every day at 01:00 AM WIB/UTC+7)
SCHEDULER_CRON_EXPRESSION="0 1 * * *"

# Timezone (must be Asia/Jakarta for WIB)
SCHEDULER_TIMEZONE="Asia/Jakarta"

# Retry Configuration
SCHEDULER_RETRY_ATTEMPTS=3
SCHEDULER_RETRY_DELAY=5000  # milliseconds

# Batch Processing
SCHEDULER_BATCH_TIMEOUT=3600000  # 1 hour in milliseconds
SCHEDULER_ENABLE_ROLLBACK=true

# Fallback Configuration (for development/testing)
SCHEDULER_ALLOW_EMPTY_HRIS_DATA=false  # Allow sync to continue with empty data when HRIS is down
```

### Database and Redis
```bash
# Database connection (same as API mode)
DATABASE_URL="postgresql://username:password@localhost:5432/cos_db"

# Redis for caching and locking
REDIS_URL="redis://localhost:6379"
```

## Scheduler Behavior

### Automatic Execution
- **Schedule**: Daily at 01:00 AM WIB (18:00 UTC)
- **Run Type**: DELTA (incremental sync)
- **Timezone**: Asia/Jakarta (UTC+7)
- **Prevention**: Concurrent executions are blocked

### Data Synchronization Scope
1. **Organization Units**:
   - Fields: code, name, parent_code, cost_center, status_aktif
   - Hierarchy validation with anti-cycle detection
   - Auto-update of RLS (Row-Level Security) filters
   - **Independent Execution**: If org sync fails, employee sync continues

2. **Employee Data**:
   - Fields: employee_no, employee_name, organization_unit, employee_status, position, job_family, supervisor, manager
   - Status deactivation for inactive employees ("active" status)
   - Role mapping based on position and job family (USER, LEADER, GA, DRIVER, FINANCE, MANAGEMENT, ADMIN, AUDITOR)
   - Approver mapping using immediate_supervisor/immediate_manager fields
   - **Always Executed**: Employee sync runs independently of organization sync status

3. **Audit Trail**:
   - Complete transaction logging
   - Batch-level error tracking
   - Retention: 5 years minimum

### Error Handling
- **Independent Module Execution**: Organization sync failure doesn't stop employee sync
- **Partial Success Support**: System continues with available data when possible
- **Granular Error Tracking**: Separate error logs for org vs employee operations
- **Approver Mapping Dependency**: Only runs if organization sync succeeds
- **Batch Rollback**: Automatic rollback on total failure
- **Retry Logic**: Configurable retry attempts with delays
- **Alerting**: Error logging for monitoring systems

## Example .env File for Scheduler

```bash
# Application
MODE=SCHEDULER
PORT=3003
NODE_ENV=production

# Database
DATABASE_URL="postgresql://cos_scheduler:password@localhost:5432/cos_db"

# Redis
REDIS_URL="redis://localhost:6379"

# HRIS Integration
HRIS_API_BASE_URL="https://msa-be.dharmagroup.co.id/api/v1"
HRIS_API_KEY="sk-prod-1234567890abcdef"
HRIS_API_TIMEOUT=30000
HRIS_API_RETRY_ATTEMPTS=3
HRIS_RATE_LIMIT_REQUESTS=100
HRIS_RATE_LIMIT_PERIOD=60000

# Scheduler
SCHEDULER_CRON_EXPRESSION="0 1 * * *"
SCHEDULER_TIMEZONE="Asia/Jakarta"
SCHEDULER_RETRY_ATTEMPTS=3
SCHEDULER_RETRY_DELAY=5000
SCHEDULER_BATCH_TIMEOUT=3600000
SCHEDULER_ENABLE_ROLLBACK=true

# Logging
LOG_LEVEL=info
```

## Starting the Scheduler

```bash
# Install dependencies
npm install

# Run database migrations
npm run prisma:migrate

# Start scheduler
npm run dev  # This will detect MODE=SCHEDULER and run the scheduler
```

## Monitoring

### Health Check
The scheduler provides endpoints for monitoring:
- **Status**: GET `/api/v1/scheduler/status`
- **History**: GET `/api/v1/scheduler/history`
- **Manual Trigger**: POST `/api/v1/scheduler/trigger` (for testing)

### Logs
- All operations are logged with structured format
- Batch IDs for traceability
- Error details for debugging
- Performance metrics (duration, record counts)

### Alerts
Configure monitoring to alert on:
- Failed sync batches
- Performance degradation
- Data consistency issues
- HRIS API connectivity problems