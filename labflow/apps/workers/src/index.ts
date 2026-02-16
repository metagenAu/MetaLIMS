// ============================================================
// LabFlow Background Job Workers - Entry Point
// ============================================================
//
// This process connects to Redis, creates all BullMQ queues and
// workers, registers the repeatable SLA check, and handles
// graceful shutdown on SIGTERM / SIGINT.
//
// Usage:
//   pnpm dev          (tsx watch in development)
//   pnpm start        (compiled JS in production)
//
// Environment:
//   REDIS_URL          - Redis connection string (default: redis://localhost:6379)
//   LOG_LEVEL          - pino log level (default: info in prod, debug in dev)
//   NODE_ENV           - "production" | "development"
// ============================================================

import IORedis from 'ioredis';
import pino from 'pino';
import type { Worker, Queue } from 'bullmq';

// Queue factories
import { createReportQueue, REPORT_QUEUE_NAME } from './queues/reportQueue.js';
import { createEmailQueue, EMAIL_QUEUE_NAME } from './queues/emailQueue.js';
import { createInvoiceQueue, INVOICE_QUEUE_NAME } from './queues/invoiceQueue.js';
import {
  createSlaQueue,
  SLA_QUEUE_NAME,
  SLA_REPEAT_OPTIONS,
} from './queues/slaQueue.js';
import {
  createAccountingSyncQueue,
  ACCOUNTING_SYNC_QUEUE_NAME,
} from './queues/accountingSyncQueue.js';

// Worker factories
import { createReportWorker } from './processors/reportProcessor.js';
import { createEmailWorker } from './processors/emailProcessor.js';
import { createInvoiceWorker } from './processors/invoiceProcessor.js';
import { createSlaWorker } from './processors/slaProcessor.js';
import { createAccountingSyncWorker } from './processors/accountingSyncProcessor.js';

// ----------------------------------------------------------------
// Logger
// ----------------------------------------------------------------

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const logger = pino({
  level: logLevel,
  ...(isProduction
    ? {
        formatters: {
          level(label: string) {
            return { level: label };
          },
          bindings(bindings: pino.Bindings) {
            return {
              pid: bindings.pid,
              host: bindings.hostname,
              service: 'labflow-workers',
            };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }),
});

// ----------------------------------------------------------------
// Redis connection
// ----------------------------------------------------------------

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnection(): IORedis {
  const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times: number) {
      const delay = Math.min(times * 500, 10_000);
      logger.warn({ attempt: times, delay }, 'Redis reconnecting...');
      return delay;
    },
  });

  redis.on('connect', () => {
    logger.info({ url: redisUrl.replace(/\/\/.*@/, '//***@') }, 'Redis connected');
  });

  redis.on('error', (err) => {
    logger.error({ err: err.message }, 'Redis connection error');
  });

  return redis;
}

// ----------------------------------------------------------------
// Main startup
// ----------------------------------------------------------------

async function main(): Promise<void> {
  logger.info('Starting LabFlow background workers...');

  // Create Redis connection for BullMQ
  const redis = createRedisConnection();

  // Wait for Redis to be ready
  await new Promise<void>((resolve, reject) => {
    if (redis.status === 'ready') {
      resolve();
      return;
    }
    redis.once('ready', resolve);
    redis.once('error', reject);

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Redis connection timeout after 30 seconds'));
    }, 30_000);
  });

  logger.info('Redis connection established');

  // BullMQ connection options (uses the existing IORedis instance)
  const connection = redis;

  // ----------------------------------------------------------
  // Create queues
  // ----------------------------------------------------------

  const reportQueue = createReportQueue(connection);
  const emailQueue = createEmailQueue(connection);
  const invoiceQueue = createInvoiceQueue(connection);
  const slaQueue = createSlaQueue(connection);
  const accountingSyncQueue = createAccountingSyncQueue(connection);

  const queues: Queue[] = [
    reportQueue,
    emailQueue,
    invoiceQueue,
    slaQueue,
    accountingSyncQueue,
  ];

  logger.info(
    {
      queues: [
        REPORT_QUEUE_NAME,
        EMAIL_QUEUE_NAME,
        INVOICE_QUEUE_NAME,
        SLA_QUEUE_NAME,
        ACCOUNTING_SYNC_QUEUE_NAME,
      ],
    },
    'All queues registered',
  );

  // ----------------------------------------------------------
  // Register repeatable SLA job
  // ----------------------------------------------------------

  await slaQueue.upsertJobScheduler(
    'sla-monitor',
    { pattern: SLA_REPEAT_OPTIONS.pattern },
    {
      name: 'slaCheck',
      data: { triggeredAt: new Date().toISOString() },
    },
  );

  logger.info(
    { schedule: SLA_REPEAT_OPTIONS.pattern },
    'SLA monitoring repeatable job registered',
  );

  // ----------------------------------------------------------
  // Create workers
  // ----------------------------------------------------------

  const reportWorker = createReportWorker(connection, logger, emailQueue);
  const emailWorker = createEmailWorker(connection, logger);
  const invoiceWorker = createInvoiceWorker(connection, logger, emailQueue);
  const slaWorker = createSlaWorker(connection, logger, emailQueue);
  const accountingSyncWorker = createAccountingSyncWorker(connection, logger);

  const workers: Worker[] = [
    reportWorker,
    emailWorker,
    invoiceWorker,
    slaWorker,
    accountingSyncWorker,
  ];

  logger.info(
    {
      workers: workers.map((w) => ({
        name: w.name,
        concurrency: w.opts.concurrency,
      })),
    },
    'All workers started',
  );

  // ----------------------------------------------------------
  // Graceful shutdown
  // ----------------------------------------------------------

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Shutdown signal received, closing workers...');

    // Close all workers first (stop processing new jobs)
    const workerClosePromises = workers.map(async (worker) => {
      try {
        await worker.close();
        logger.info({ worker: worker.name }, 'Worker closed');
      } catch (err) {
        logger.error(
          { worker: worker.name, err: (err as Error).message },
          'Error closing worker',
        );
      }
    });

    await Promise.allSettled(workerClosePromises);

    // Close all queues
    const queueClosePromises = queues.map(async (queue) => {
      try {
        await queue.close();
        logger.info({ queue: queue.name }, 'Queue closed');
      } catch (err) {
        logger.error(
          { queue: queue.name, err: (err as Error).message },
          'Error closing queue',
        );
      }
    });

    await Promise.allSettled(queueClosePromises);

    // Disconnect Redis
    try {
      await redis.quit();
      logger.info('Redis disconnected');
    } catch (err) {
      logger.error(
        { err: (err as Error).message },
        'Error disconnecting Redis',
      );
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception');
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal(
      { reason: reason instanceof Error ? reason.message : String(reason) },
      'Unhandled rejection',
    );
    shutdown('unhandledRejection').catch(() => process.exit(1));
  });

  logger.info('LabFlow background workers are running. Waiting for jobs...');
}

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------

main().catch((err) => {
  logger.fatal(
    { err: err instanceof Error ? err.message : String(err) },
    'Failed to start workers',
  );
  process.exit(1);
});
