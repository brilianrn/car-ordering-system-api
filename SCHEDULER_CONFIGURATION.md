# Scheduler Configuration Guide

## Environment Variables

The scheduler requires specific environment variables to be configured. Create a `.env.scheduler` file with the following variables:

### Application Mode
```bash
MODE=SCHEDULER
PORT=3003
NODE_ENV=production
```

### Database Configuration
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/cos_db?schema=public"
```

### Redis Configuration
```bash
REDIS_URL="redis://localhost:6379"
```

### HRIS Integration Configuration
```bash
# HRIS API endpoint and authentication
HRIS_API_BASE_URL="https://hris-api.company.com/api/v1"
HRIS_API_KEY="your-hris-api-key-here"

# API timeout and retry configuration
HRIS_API_TIMEOUT=30000
HRIS_API_RETRY_ATTEMPTS=3

# Rate limiting for HRIS API calls
HRIS_RATE_LIMIT_REQUESTS=100
HRIS_RATE_LIMIT_PERIOD=60000
```

### Scheduler Configuration
```bash
# Cron expression for daily sync at 01:00 AM WIB
SCHEDULER_CRON_EXPRESSION="0 1 * * *"
SCHEDULER_TIMEZONE="Asia/Jakarta"

# Retry and timeout configuration
SCHEDULER_RETRY_ATTEMPTS=3
SCHEDULER_RETRY_DELAY=5000
SCHEDULER_BATCH_TIMEOUT=3600000
SCHEDULER_ENABLE_ROLLBACK=true
```

### Audit and Logging
```bash
LOG_LEVEL=info
LOG_FILE_PATH="/var/log/cos-scheduler"
AUDIT_RETENTION_DAYS=1825  # 5 years retention
```

### Security
```bash
JWT_SECRET="your-jwt-secret-here"
ENCRYPTION_KEY="your-encryption-key-here"
```

## Running the Scheduler

### Development Mode
```bash
# Set environment variables or use .env.scheduler file
export MODE=SCHEDULER
export PORT=3003
# ... other variables

npm run dev
```

### Production Mode
```bash
# Using environment file
cp .env.scheduler .env
npm run start:prod
```

### Docker Deployment
```bash
docker build -t cos-scheduler .
docker run -p 3003:3003 --env-file .env.scheduler cos-scheduler
```

## API Endpoints

When running in SCHEDULER mode, the following API endpoints are available:

- `POST /api/v1/scheduler/sync/trigger` - Manually trigger sync
- `GET /api/v1/scheduler/sync/status` - Get current sync status
- `GET /api/v1/scheduler/sync/history` - Get sync history
- `GET /api/v1/scheduler/sync/summary` - Get sync summary
- `POST /api/v1/scheduler/cleanup` - Cleanup old audit data

## Monitoring

The scheduler includes comprehensive logging and monitoring:

- All sync operations are logged with detailed metrics
- Failed operations trigger alerts (configurable)
- Performance metrics are tracked
- Audit trails are maintained for compliance

## Troubleshooting

### Common Issues

1. **HRIS API Connection Failed**
   - Check `HRIS_API_BASE_URL` and `HRIS_API_KEY`
   - Verify network connectivity to HRIS API
   - Check API rate limits

2. **Database Connection Issues**
   - Verify `DATABASE_URL` configuration
   - Ensure database is accessible
   - Check database permissions

3. **Cron Job Not Running**
   - Verify `SCHEDULER_CRON_EXPRESSION`
   - Check timezone settings
   - Ensure scheduler mode is enabled

4. **Memory Issues**
   - Monitor memory usage during large sync operations
   - Consider batch size adjustments
   - Check for memory leaks in HRIS client

### Logs Location

- Application logs: Configured via `LOG_FILE_PATH`
- Database logs: Check PostgreSQL logs
- Audit logs: Stored in `audit_sync` table

## Security Considerations

- Store sensitive configuration in secure environment variables
- Use strong API keys for HRIS integration
- Implement proper access controls for scheduler endpoints
- Regularly rotate authentication tokens
- Monitor for unusual sync patterns that may indicate security issues