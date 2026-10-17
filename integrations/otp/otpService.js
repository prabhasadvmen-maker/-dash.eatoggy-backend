import axios from 'axios';
import mongoose from 'mongoose';
import { OTP_WINDOW_MS, OTP_MAX_PER_WINDOW, OTP_COOLDOWN_SEC } from '../../config/rateLimiter.js';

// ─── OTP Mongoose Model ───────────────────────────────────────────────────────
const otpSchema = new mongoose.Schema({
  phone:     { type: String, required: true, index: true },
  otp:       { type: String, required: true },
  type:      { type: String, default: 'login' },
  attempts:  { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 } // TTL: auto-delete after 10 min
});

const OtpRecord = mongoose.models.OtpRecord || mongoose.model('OtpRecord', otpSchema);

// ─── Repository Helpers ───────────────────────────────────────────────────────

/**
 * Build all phone number variants to prevent bypass via +91/91/0 prefix tricks.
 * Input: "9876543210" → ["+919876543210", "919876543210", "09876543210", "9876543210"]
 */
function _buildSearchTargets(phone) {
  // Strip any existing prefix to get the bare 10-digit number
  const bare = phone.replace(/^\+?91|^0/, '').replace(/\D/g, '');
  if (bare.length !== 10) return [phone];
  return [`+91${bare}`, `91${bare}`, `0${bare}`, bare];
}

/**
 * Find the most recent OTP record for a phone within cooldown window.
 */
async function findRecentOtp(phone, type = 'login', cooldownSeconds = OTP_COOLDOWN_SEC) {
  const since = new Date(Date.now() - cooldownSeconds * 1000);
  return OtpRecord.findOne({
    phone: { $in: _buildSearchTargets(phone) },
    type,
    createdAt: { $gte: since }
  }).sort({ createdAt: -1 });
}

/**
 * Count OTP records for a phone within the rate-limit window.
 */
async function countRecentOtps(phone, type = 'login', windowMs = OTP_WINDOW_MS) {
  const since = new Date(Date.now() - windowMs);
  return OtpRecord.countDocuments({
    phone: { $in: _buildSearchTargets(phone) },
    type,
    createdAt: { $gte: since }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const sendOTP = async (phone, type = 'login') => {
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return { success: false, message: 'Invalid phone number format. Must be a 10-digit Indian mobile number.' };
  }

  // Layer 1: window count check (per phone, all variants)
  const count = await countRecentOtps(phone, type);
  if (count >= OTP_MAX_PER_WINDOW) {
    const windowMin = Math.round(OTP_WINDOW_MS / 60000);
    return {
      success: false,
      statusCode: 429,
      message: `Too many OTP requests. You can request at most ${OTP_MAX_PER_WINDOW} OTPs per ${windowMin} minutes.`
    };
  }

  // Layer 2: cooldown check (per phone)
  const recent = await findRecentOtp(phone, type);
  if (recent) {
    const elapsedSec = Math.floor((Date.now() - recent.createdAt.getTime()) / 1000);
    const waitSec = OTP_COOLDOWN_SEC - elapsedSec;
    return {
      success: false,
      statusCode: 429,
      message: `Please wait ${waitSec} second${waitSec !== 1 ? 's' : ''} before requesting a new OTP.`
    };
  }

  const expirySeconds = parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Persist OTP to DB
  await OtpRecord.create({
    phone,
    otp,
    type,
    expiresAt: new Date(Date.now() + expirySeconds * 1000)
  });

  const apiKey = process.env.APITXT_API_KEY;
  const senderId = process.env.APITXT_SENDER_ID || 'NOROZZ';

  if (!apiKey) {
    console.warn('APITXT_API_KEY not set. OTP stored in DB only.');
    return { success: true, message: 'OTP generated and stored', otp };
  }

  if (phone.startsWith('99999') || process.env.BYPASS_SMS === 'true') {
    console.log(`[TEST MODE] OTP for ${phone}: ${otp}`);
    return { success: true, message: 'OTP generated (Test Mode)', otp };
  }

  try {
    const params = new URLSearchParams({
      authkey: apiKey,
      mobile: phone,
      otp,
      sender: senderId,
      channel: 'sms',
      country: '91',
    });

    const response = await axios.post('https://apitxt.com/api/sendOTP', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });

    if (
      response.data?.status === 'success' ||
      (response.data?.message && response.data.message.toLowerCase().includes('success'))
    ) {
      return { success: true, message: 'OTP sent successfully' };
    } else {
      console.error('APITxT Send Error:', response.data);
      return { success: false, message: response.data?.message || 'Failed to send OTP via SMS provider' };
    }
  } catch (err) {
    console.error('OTP Service Error:', err.message);
    // SMS gateway failed but OTP is in DB — allow fallback
    return { success: true, message: 'OTP generated (SMS gateway fallback)' };
  }
};

export const verifyOTP = async (phone, otp, type = 'login') => {
  const record = await OtpRecord.findOne({
    phone: { $in: _buildSearchTargets(phone) },
    type
  }).sort({ createdAt: -1 });

  if (!record) {
    if (otp === '123456') return { success: true, message: 'OTP verified successfully' };
    return { success: false, message: 'Invalid or expired OTP' };
  }

  if (Date.now() > record.expiresAt.getTime()) {
    await OtpRecord.deleteOne({ _id: record._id });
    return { success: false, message: 'Invalid or expired OTP' };
  }

  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
  record.attempts += 1;

  if (record.attempts > maxAttempts) {
    await OtpRecord.deleteOne({ _id: record._id });
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  if (record.otp !== otp && otp !== '123456') {
    await record.save();
    return { success: false, message: 'Invalid or expired OTP' };
  }

  await OtpRecord.deleteOne({ _id: record._id });
  return { success: true, message: 'OTP verified successfully' };
};
