import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { globalLogger as Logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var dbPool: Pool | undefined;
}

// Create pool with proper configuration
// Use singleton pattern to prevent multiple pool instances
const pool =
  global.dbPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of clients in the pool
    min: 5, // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    statement_timeout: 30000, // Query timeout in milliseconds
    query_timeout: 30000, // Query timeout in milliseconds
    // Prevent pool from being ended while in use
    allowExitOnIdle: false,
  });

// Track if pool is ended to prevent usage after end
let poolEnded = false;

// Handle pool errors
pool.on('error', (err) => {
  // Don't log errors if pool is already ended
  if (!poolEnded) {
    Logger.error(`Unexpected error on idle database client: ${err.message}`, err.stack, 'DatabasePool');
  }
});

// Handle pool connection events
pool.on('connect', () => {
  Logger.debug('New database client connected', 'DatabasePool');
});

pool.on('remove', () => {
  Logger.debug('Database client removed from pool', 'DatabasePool');
});

if (process.env.NODE_ENV !== 'production') {
  global.dbPool = pool;
}

const adapter = new PrismaPg(pool);

export const clientDb =
  global.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  });

// Add connection error handling
clientDb.$on('error' as never, (e: any) => {
  Logger.error(`Prisma Client Error: ${e.message}`, e.stack, 'PrismaClient');
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = clientDb;
}

// Graceful shutdown handler
// Note: We don't end the pool here because PrismaPg adapter manages it
// Only disconnect Prisma client to allow graceful shutdown
if (typeof process !== 'undefined') {
  let isShuttingDown = false;

  const gracefulShutdown = async () => {
    if (isShuttingDown) {
      return; // Prevent multiple shutdown calls
    }
    isShuttingDown = true;
    poolEnded = true;

    Logger.info('Shutting down database connections...', 'DatabaseShutdown');
    try {
      // Only disconnect Prisma client
      // Pool will be cleaned up automatically by the adapter or on process exit
      // DO NOT call pool.end() here as it can cause "Cannot use a pool after calling end" errors
      await clientDb.$disconnect();
      Logger.info('Database connections closed successfully', 'DatabaseShutdown');
    } catch (error) {
      Logger.error(
        `Error during database shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'DatabaseShutdown',
      );
    }
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  // Don't use beforeExit as it can cause issues with async operations
}

export { pool as dbPool };
