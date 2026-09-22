import mongoose from 'mongoose';
import { dbConfig, logger, validateEnv } from '../config/index.js';

export const connectDB = async () => {
  validateEnv();
  try {
    const conn = await mongoose.connect(dbConfig.uri, dbConfig.options);
    logger.info('MongoDB Connected');
    return conn;
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

export default connectDB;
