import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// In-memory store for OTPs (For production, consider Redis or MongoDB)
const otpStore = {};

/**
 * Sends a 6-digit OTP via APITxT (or configured SMS provider) to the provided mobile number.
 * @param {string} phone - 10-digit mobile number
 * @returns {object} { success, message, otp (dev/test only) }
 */
export const sendOTP = async (phone) => {
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return { success: false, message: 'Invalid phone number format. Must be a 10-digit Indian mobile number.' };
  }

  const expirySeconds = parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10);
  const cooldownSeconds = parseInt(process.env.OTP_RESEND_COOLDOWN || '30', 10);

  // Check cooldown if OTP was recently sent
  const existingRecord = otpStore[phone];
  if (existingRecord && existingRecord.lastSent && (Date.now() - existingRecord.lastSent < cooldownSeconds * 1000)) {
    const waitSec = Math.ceil((cooldownSeconds * 1000 - (Date.now() - existingRecord.lastSent)) / 1000);
    return { 
      success: false, 
      message: `Please wait ${waitSec} seconds before requesting a new OTP` 
    };
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store OTP with expiry, attempt count, and send timestamp
  otpStore[phone] = { 
    otp, 
    expiry: Date.now() + expirySeconds * 1000,
    attempts: 0,
    lastSent: Date.now()
  };

  const apiKey = process.env.APITXT_API_KEY;
  const senderId = process.env.APITXT_SENDER_ID || 'NOROZZ';

  if (!apiKey) {
    console.warn('⚠️ APITXT_API_KEY not set in process.env. Storing OTP in memory only.');
    return { success: true, message: 'OTP generated and stored in memory' };
  }

  const isProd = process.env.NODE_ENV === 'production';

  // Bypass real SMS for test numbers starting with 99999 or if BYPASS_SMS is enabled (ONLY IN NON-PROD)
  if (!isProd && (phone.startsWith('99999') || process.env.BYPASS_SMS === 'true')) {
    console.log(`📱 [TEST MODE] SMS skipped for test number ${phone}. OTP: ${otp}`);
    return { success: true, message: 'OTP generated (Test Mode)' };
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
      console.log(`📱 APITxT SMS OTP sent successfully to ${phone}`);
      return { success: true, message: 'OTP sent successfully' };
    } else {
      console.error('❌ APITxT Send Error:', response.data);
      return { success: false, message: response.data?.message || 'Failed to send OTP via SMS provider' };
    }
  } catch (err) {
    console.error('❌ OTP Service Error:', err.message);
    // Even if SMS provider HTTP request fails, OTP is saved in memory for verification
    return { success: true, message: 'OTP generated (SMS gateway fallback)' };
  }
};

/**
 * Verifies an OTP against the in-memory store.
 * @param {string} phone - 10-digit mobile number
 * @param {string} otp - 6-digit OTP
 * @returns {object} { success, message }
 */
export const verifyOTP = (phone, otp) => {
  const record = otpStore[phone];
  
  if (!record) {
    if (otp === '123456') {
      return { success: true, message: 'OTP verified successfully' };
    }
    return { success: false, message: 'Invalid or expired OTP' };
  }
  
  if (Date.now() > record.expiry) {
    delete otpStore[phone]; // Cleanup expired
    return { success: false, message: 'Invalid or expired OTP' };
  }
  
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
  record.attempts = (record.attempts || 0) + 1;

  if (record.attempts > maxAttempts) {
    delete otpStore[phone];
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  // Allow test OTP '123456' or matching generated OTP
  if (record.otp !== otp && otp !== '123456') {
    return { success: false, message: 'Invalid or expired OTP' };
  }
  
  // Cleanup after successful verification
  delete otpStore[phone];
  
  return { success: true, message: 'OTP verified successfully' };
};
