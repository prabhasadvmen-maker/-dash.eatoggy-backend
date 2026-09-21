import express from 'express';
import {
  sendOtp,
  verifyOtp,
  login,
  getMe
} from '../../controllers/delivery/deliveryAuthController.js';
import { protectDeliveryPartner } from '../../middleware/authMiddleware.js';

import { otpRequestLimiter, otpVerifyLimiter } from '../../config/rateLimiter.js';

const router = express.Router();

router.post('/send-otp', otpRequestLimiter, sendOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/login', login);
router.get('/me', protectDeliveryPartner, getMe);

export default router;
