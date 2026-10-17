import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

// OTP config constants — shared across rate limiter & OTP service
export const OTP_WINDOW_MS = 10 * 60 * 1000;           // 10 minutes
export const OTP_MAX_PER_WINDOW = isProd ? 3 : 10;      // 3 prod / 10 dev
export const OTP_COOLDOWN_SEC = isProd ? 60 : 10;       // 60s prod / 10s dev

// Global API rate limiter
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP Request: IP-based guard (phone-based guard is in otpService)
export const otpRequestLimiter = rateLimit({
  windowMs: OTP_WINDOW_MS,
  max: OTP_MAX_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests from this IP. Please try again later.' },
});

// OTP Verify: max 5 attempts per 10 minutes per IP
export const otpVerifyLimiter = rateLimit({
  windowMs: OTP_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
});
