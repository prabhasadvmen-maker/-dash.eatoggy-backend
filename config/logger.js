import winston from 'winston';

const SENSITIVE_KEYS = [
  'password', 'token', 'otp', 'secret', 'authorization', 'creditcard',
  'cvv', 'jwt_secret', 'razorpay_key_secret', 'r2_secret_access_key', 'mongodb_uri'
];

const redact = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = redact(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

const myFormat = winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
  const reqId = requestId ? ` [ReqID: ${requestId}]` : '';
  const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(redact(meta))}` : '';
  return `[${timestamp}] [${level.toUpperCase()}]${reqId} ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    process.env.NODE_ENV === 'production' 
      ? winston.format.json() // Use JSON in production for easy parsing by Datadog/ELK
      : myFormat
  ),
  transports: [
    new winston.transports.Console()
  ],
});

export default logger;
