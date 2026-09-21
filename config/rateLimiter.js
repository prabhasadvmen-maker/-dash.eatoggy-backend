import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from './redis.js';

// Helper to block if Redis is unavailable in production
const enforceRedisInProduction = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && (!redisClient || !redisClient.isReady)) {
    return res.status(503).json({ success: false, message: 'Security dependency unavailable. Please try again later.' });
  }
  next();
};

// Global API rate limiter (optional, but good for general endpoints)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }) : undefined, // Fallback to memory store if Redis is unavailable (Non-critical)
});

// OTP Request Rate Limiter: max 3 requests per 15 minutes per IP
const _otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 OTP requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests from this IP, please try again after 15 minutes.' },
  store: redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:otp:',
  }) : undefined,
});

// Wrapper to enforce security fail-close
export const otpRequestLimiter = (req, res, next) => {
  enforceRedisInProduction(req, res, () => _otpRequestLimiter(req, res, next));
};

// OTP Verification Limiter: max 5 attempts per 15 minutes per IP
const _otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts, please try again after 15 minutes.' },
  store: redisClient ? new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:otp_verify:',
  }) : undefined,
});

export const otpVerifyLimiter = (req, res, next) => {
  enforceRedisInProduction(req, res, () => _otpVerifyLimiter(req, res, next));
};
