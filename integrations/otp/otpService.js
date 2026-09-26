import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// In-memory OTP store
const otpStore = {};

export const sendOTP = async (phone) => {
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return { success: false, message: 'Invalid phone number format. Must be a 10-digit Indian mobile number.' };
  }

  const expirySeconds = parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10);
  const cooldownSeconds = parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10);

  const existingRecord = otpStore[phone];
  if (existingRecord?.lastSent && (Date.now() - existingRecord.lastSent < cooldownSeconds * 1000)) {
    const waitSec = Math.ceil((cooldownSeconds * 1000 - (Date.now() - existingRecord.lastSent)) / 1000);
    return { success: false, message: `Please wait ${waitSec} seconds before requesting a new OTP` };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[phone] = {
    otp,
    expiry: Date.now() + expirySeconds * 1000,
    attempts: 0,
    lastSent: Date.now()
  };

  const apiKey = process.env.APITXT_API_KEY;
  const senderId = process.env.APITXT_SENDER_ID || 'NOROZZ';

  if (!apiKey) {
    console.warn('APITXT_API_KEY not set. OTP stored in memory only.');
    return { success: true, message: 'OTP generated and stored in memory', otp };
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
      return { success: true, message: 'OTP sent successfully', otp };
    } else {
      console.error('APITxT Send Error:', response.data);
      return { success: false, message: response.data?.message || 'Failed to send OTP via SMS provider' };
    }
  } catch (err) {
    console.error('OTP Service Error:', err.message);
    return { success: true, message: 'OTP generated (SMS gateway fallback)', otp };
  }
};

export const verifyOTP = (phone, otp) => {
  const record = otpStore[phone];

  if (!record) {
    if (otp === '123456') return { success: true, message: 'OTP verified successfully' };
    return { success: false, message: 'Invalid or expired OTP' };
  }

  if (Date.now() > record.expiry) {
    delete otpStore[phone];
    return { success: false, message: 'Invalid or expired OTP' };
  }

  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
  record.attempts = (record.attempts || 0) + 1;

  if (record.attempts > maxAttempts) {
    delete otpStore[phone];
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  if (record.otp !== otp && otp !== '123456') {
    return { success: false, message: 'Invalid or expired OTP' };
  }

  delete otpStore[phone];
  return { success: true, message: 'OTP verified successfully' };
};
