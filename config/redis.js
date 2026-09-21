import { createClient } from 'redis';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL
  });

  redisClient.on('error', (err) => logger.error('Redis Client Error', { error: err.message }));
  redisClient.on('connect', () => logger.info('Redis Client Connected'));
  redisClient.on('ready', () => logger.info('Redis Client Ready'));

  // Connect without blocking the main event loop initially
  redisClient.connect().catch(err => {
    logger.error('Failed to connect to Redis on startup', { error: err.message });
  });
} else {
  logger.warn('REDIS_URL not provided. Running without Redis support.');
}

export default redisClient;
