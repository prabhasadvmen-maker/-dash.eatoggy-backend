import express from 'express';
import {
  signup,
  sendOtp,
  verifyOtp,
  login,
  getMe,
  getDashboard,
  saveLocation,
  updateProfile,
  deleteAccount,
  logout
} from '../../controllers/customers/customerAuthController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

import { otpRequestLimiter, otpVerifyLimiter } from '../../config/rateLimiter.js';

const router = express.Router();

// Public routes
router.post('/signup', signup);
router.post('/send-otp', otpRequestLimiter, sendOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/login', login);

// Protected routes (Customer JWT required)
router.get('/me', protectCustomer, getMe);
router.patch('/me', protectCustomer, updateProfile);
router.delete('/account', protectCustomer, deleteAccount);
router.post('/logout', protectCustomer, logout);
router.get('/dashboard', protectCustomer, getDashboard);
router.post('/location', protectCustomer, saveLocation);

export default router;
