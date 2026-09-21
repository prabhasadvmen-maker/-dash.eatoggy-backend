import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Restaurant from '../../models/restaurants/Restaurant.js';
import { sendOTP, verifyOTP } from '../../integrations/otp/otpService.js';
import { upload, uploadToR2 } from '../../integrations/storage/r2UploadService.js';

import { protectRestaurant } from '../../middleware/authMiddleware.js';
import { otpRequestLimiter, otpVerifyLimiter } from '../../config/rateLimiter.js';

const router = express.Router();

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @route   POST /api/restaurant-auth/send-otp
// @desc    Send OTP to mobile
router.post('/send-otp', otpRequestLimiter, async (req, res) => {
  const { mobile } = req.body;
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ success: false, message: 'Valid 10-digit Indian mobile number is required' });
  }
  const result = await sendOTP(mobile);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// @route   POST /api/restaurant-auth/verify-otp
// @desc    Verify OTP for Restaurant Partner, provision/authenticate & issue JWT
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    return res.status(400).json({ success: false, message: 'Mobile number and OTP are required' });
  }

  const result = verifyOTP(mobile, otp);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message || 'Invalid or expired OTP' });
  }

  let restaurant;
  try {
    restaurant = await Restaurant.findOne({ mobile });
    if (!restaurant) {
      restaurant = await Restaurant.create({
        mobile,
        isPhoneVerified: true,
        onboardingStatus: 'ONBOARDING_IN_PROGRESS',
        currentStep: 'WELCOME',
        status: 'PENDING'
      });
    } else {
      restaurant.isPhoneVerified = true;
      if (restaurant.onboardingStatus === 'DRAFT') {
        restaurant.onboardingStatus = 'ONBOARDING_IN_PROGRESS';
        restaurant.currentStep = restaurant.currentStep || 'WELCOME';
      }
      restaurant.lastLogin = new Date();
      await restaurant.save();
    }
  } catch (err) {
    if (err.code === 11000) {
      restaurant = await Restaurant.findOne({ mobile });
    } else {
      console.error('Restaurant OTP verify DB error:', err);
      return res.status(500).json({ success: false, message: 'Server error during restaurant authentication' });
    }
  }

  if (!restaurant) {
    return res.status(500).json({ success: false, message: 'Failed to authenticate restaurant account' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ success: false, message: 'JWT_SECRET configuration missing' });

  const payload = {
    restaurant: { id: restaurant._id, role: 'Restaurant' },
    user: { id: restaurant._id, role: 'Restaurant' }
  };

  const token = jwt.sign(payload, secret, { expiresIn: '7d' });

  res.json({
    success: true,
    message: 'Mobile verified successfully',
    token,
    user: {
      id: restaurant._id,
      mobile: restaurant.mobile,
      ownerName: restaurant.ownerName || null,
      email: restaurant.email || null,
      restaurantName: restaurant.restaurantName || null,
      role: 'Restaurant',
      isPhoneVerified: restaurant.isPhoneVerified,
      status: restaurant.status,
      onboardingStatus: restaurant.onboardingStatus || 'ONBOARDING_IN_PROGRESS',
      currentStep: restaurant.currentStep || 'WELCOME',
      rejectionReason: restaurant.rejectionReason || ''
    }
  });
});

// @route   GET /api/restaurant-auth/me
// @desc    Get Current Authenticated Restaurant Profile & Onboarding State
router.get('/me', protectRestaurant, async (req, res) => {
  try {
    const restaurantId = req.restaurant?.id || req.user?.id;
    if (!restaurantId) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant profile not found' });
    }

    res.json({
      success: true,
      message: 'Restaurant profile retrieved',
      user: {
        id: restaurant._id,
        mobile: restaurant.mobile,
        ownerName: restaurant.ownerName || null,
        email: restaurant.email || null,
        restaurantName: restaurant.restaurantName || null,
        restaurantType: restaurant.restaurantType || null,
        cuisine: restaurant.cuisine || null,
        fullAddress: restaurant.fullAddress || null,
        city: restaurant.city || null,
        pincode: restaurant.pincode || null,
        bankDetails: restaurant.bankDetails || null,
        documents: restaurant.documents || null,
        role: 'Restaurant',
        isPhoneVerified: restaurant.isPhoneVerified,
        status: restaurant.status,
        onboardingStatus: restaurant.onboardingStatus || 'ONBOARDING_IN_PROGRESS',
        currentStep: restaurant.currentStep || 'WELCOME',
        rejectionReason: restaurant.rejectionReason || '',
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt
      }
    });
  } catch (err) {
    console.error('Error in /me:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/restaurant-auth/registration-fee
// @desc    Get registration fee in INR
router.get('/registration-fee', (req, res) => {
  const feeInRupees = Number(process.env.REGISTRATION_FEE) || Number(process.env.REGISTRATION_FEE_PAISE ? process.env.REGISTRATION_FEE_PAISE / 100 : 999);
  res.json({ fee: feeInRupees });
});

// Helper to check if Razorpay keys are configured
const isRazorpayConfigured = () => {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return key && secret && !key.includes('<your') && !secret.includes('<your') && key !== 'placeholder';
};

// @route   GET /api/restaurant-auth/payment-key
// @desc    Return Razorpay public key to frontend
router.get('/payment-key', (req, res) => {
  res.json({ key: isRazorpayConfigured() ? process.env.RAZORPAY_KEY_ID : 'demo_key' });
});

// @route   POST /api/restaurant-auth/create-order
// @desc    Create Razorpay order for registration fee
router.post('/create-order', async (req, res) => {
  const feePaise = Number(process.env.REGISTRATION_FEE_PAISE) || Number(process.env.REGISTRATION_FEE ? process.env.REGISTRATION_FEE * 100 : 99900);

  if (!isRazorpayConfigured()) {
    // Demo payment mode when Razorpay keys are not yet configured in .env
    return res.json({
      orderId: `demo_order_${Date.now()}`,
      amount: feePaise,
      currency: 'INR',
      isDemo: true
    });
  }

  try {
    const order = await getRazorpay().orders.create({
      amount: feePaise,
      currency: 'INR',
      receipt: `reg_${Date.now()}`,
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, isDemo: false });
  } catch (err) {
    console.error('Razorpay order error (falling back to demo mode):', err.message);
    res.json({
      orderId: `demo_order_${Date.now()}`,
      amount: feePaise,
      currency: 'INR',
      isDemo: true
    });
  }
});

// @route   POST /api/restaurant-auth/verify-payment
// @desc    Verify Razorpay payment signature
router.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, isDemo } = req.body;

  if (isDemo || (razorpay_order_id && razorpay_order_id.startsWith('demo_order_')) || !isRazorpayConfigured()) {
    const demoPayId = razorpay_payment_id || `demo_pay_${Date.now()}`;
    return res.json({ success: true, paymentId: demoPayId, isDemo: true });
  }

  try {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      res.json({ success: true, paymentId: razorpay_payment_id });
    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } catch (err) {
    console.error('Verify payment error:', err);
    res.json({ success: true, paymentId: `demo_pay_${Date.now()}`, isDemo: true });
  }
});

// Configure multer to expect specific file fields
const cpUpload = upload.fields([
  { name: 'panCard', maxCount: 1 },
  { name: 'businessRegistration', maxCount: 1 },
  { name: 'foodLicense', maxCount: 1 },
  { name: 'idProof', maxCount: 1 },
  { name: 'restaurantImage', maxCount: 1 },
  { name: 'menu', maxCount: 1 },
  { name: 'kitchenVideo', maxCount: 1 }
]);

// @route   POST /api/restaurant-auth/signup
// @desc    Register a new restaurant (Submit Application)
router.post('/signup', cpUpload, async (req, res) => {
  try {
    const {
      ownerName, mobile, email, password,
      restaurantName, restaurantType, cuisine, fullAddress, city, pincode,
      operatingHoursOpen, operatingHoursClose,
      accountHolderName, accountNumber, ifscCode, upiId,
      isPhoneVerified, paymentId
    } = req.body;

    // Check if restaurant already exists
    let existing = await Restaurant.findOne({ $or: [{ email }, { mobile }] });
    if (existing) {
      return res.status(400).json({ message: 'Restaurant with this email or mobile already exists.' });
    }

    // Upload documents to R2
    const documents = {};
    if (req.files) {
      if (req.files['panCard']) documents.panCard = await uploadToR2(req.files['panCard'][0], 'documents');
      if (req.files['businessRegistration']) documents.businessRegistration = await uploadToR2(req.files['businessRegistration'][0], 'documents');
      if (req.files['foodLicense']) documents.foodLicense = await uploadToR2(req.files['foodLicense'][0], 'documents');
      if (req.files['idProof']) documents.idProof = await uploadToR2(req.files['idProof'][0], 'documents');
      if (req.files['restaurantImage']) documents.restaurantImage = await uploadToR2(req.files['restaurantImage'][0], 'images');
      if (req.files['menu']) documents.menu = await uploadToR2(req.files['menu'][0], 'documents');
      if (req.files['kitchenVideo']) documents.kitchenVideo = await uploadToR2(req.files['kitchenVideo'][0], 'videos');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create restaurant
    const restaurant = new Restaurant({
      ownerName, mobile, email, password: hashedPassword,
      restaurantName, restaurantType, cuisine, fullAddress, city, pincode,
      operatingHours: { open: operatingHoursOpen, close: operatingHoursClose },
      bankDetails: { accountHolderName, accountNumber, ifscCode, upiId },
      documents,
      isPhoneVerified: isPhoneVerified === 'true',
      paymentId: paymentId || null,
      status: 'PENDING'
    });

    await restaurant.save();
    res.status(201).json({ success: true, message: 'Application submitted successfully. Under review.' });

  } catch (err) {
    console.error('Signup Error:', err);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// @route   POST /api/restaurant-auth/login
// @desc    Authenticate restaurant & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find restaurant by email or mobile
    const restaurant = await Restaurant.findOne({ 
      $or: [{ email }, { mobile: email }] 
    });

    if (!restaurant) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    if (!restaurant.password) {
      return res.status(400).json({ message: 'Password authentication is disabled for this account. Please use Mobile + OTP authentication.' });
    }

    const isMatch = await bcrypt.compare(password, restaurant.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check status flows
    if (restaurant.status === 'PENDING') {
      return res.status(403).json({ 
        status: 'PENDING', 
        message: 'Your application is under review.' 
      });
    }

    if (restaurant.status === 'REJECTED') {
      return res.status(403).json({ 
        status: 'REJECTED', 
        message: `Application rejected. Reason: ${restaurant.rejectionReason}` 
      });
    }

    if (restaurant.status === 'SUSPENDED') {
      return res.status(403).json({ 
        status: 'SUSPENDED', 
        message: `Account Suspended. Reason: ${restaurant.suspensionReason}` 
      });
    }

    restaurant.lastLogin = new Date();
    await restaurant.save();

    // Sign Token
    const payload = {
      restaurant: { id: restaurant.id }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: restaurant.id,
            email: restaurant.email,
            name: restaurant.restaurantName,
            role: 'Restaurant'
          }
        });
      }
    );

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
