import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load default .env from process.cwd() or fallback to server/.env relative to this file
dotenv.config();
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  FRONTEND_URL: process.env.FRONTEND_URL || '',
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL || '',
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || '',
  APITXT_API_KEY: process.env.APITXT_API_KEY || '',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ENDPOINT: process.env.R2_ENDPOINT || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET: process.env.R2_BUCKET || '',
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
};

export function validateEnv() {
  const missing = [];
  if (!env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!env.JWT_SECRET) missing.push('JWT_SECRET');
  if (missing.length > 0) {
    console.error(`ERROR: Missing required env variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
