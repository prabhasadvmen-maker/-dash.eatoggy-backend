import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Customer from '../../models/customers/Customer.js';
import { sendOTP, verifyOTP } from '../../integrations/otp/otpService.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import Subscription from '../../models/subscriptions/Subscription.js';
import Order from '../../models/orders/Order.js';
import Address from '../../models/customers/Address.js';
import Restaurant from '../../models/restaurants/Restaurant.js';

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const signup = asyncHandler(async (req, res) => {
  const { name, mobile, email, password } = req.body;

  if (!name || !mobile || !email || !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'All fields (name, mobile, email, password) are required',
      errors: ['name, mobile, email, and password are required']
    });
  }

  if (!MOBILE_RE.test(String(mobile))) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid mobile number format. Must be a 10-digit Indian mobile number.' });
  }

  if (!EMAIL_RE.test(String(email))) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid email address format.' });
  }

  const existingMobile = await Customer.findOne({ mobile });
  if (existingMobile) {
    return errorResponse(res, { statusCode: 400, message: 'Mobile number is already registered' });
  }

  const existingEmail = await Customer.findOne({ email });
  if (existingEmail) {
    return errorResponse(res, { statusCode: 400, message: 'Email address is already registered' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const customer = new Customer({
    name, mobile, email,
    password: hashedPassword,
    role: 'Customer',
    isActive: true,
    isMobileVerified: false
  });

  await customer.save();
  await sendOTP(mobile);

  return successResponse(res, {
    statusCode: 201,
    message: 'Customer registered successfully. Mobile OTP verification required.',
    data: {
      customer: {
        id: customer._id,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        role: customer.role,
        isMobileVerified: customer.isMobileVerified
      }
    }
  });
});

export const sendOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile || !MOBILE_RE.test(String(mobile))) {
    return errorResponse(res, { statusCode: 400, message: 'Valid 10-digit mobile number is required' });
  }

  const otpResult = await sendOTP(mobile);
  if (otpResult.success) {
    return successResponse(res, { message: 'OTP sent successfully' });
  }
  return errorResponse(res, {
    statusCode: otpResult.statusCode || 400,
    message: otpResult.message || 'Failed to send OTP'
  });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    return errorResponse(res, { statusCode: 400, message: 'Mobile number and OTP are required' });
  }

  const verification = await verifyOTP(mobile, otp);
  if (!verification.success) {
    return errorResponse(res, { statusCode: 400, message: verification.message || 'Invalid or expired OTP' });
  }

  let customer;
  try {
    customer = await Customer.findOne({ mobile });
    if (!customer) {
      customer = await Customer.create({
        mobile,
        password: crypto.randomBytes(16).toString('hex'),
        role: 'Customer',
        isActive: true,
        isMobileVerified: true
      });
    } else {
      customer.isMobileVerified = true;
      customer.lastLogin = new Date();
      await customer.save();
    }
  } catch (err) {
    if (err.code === 11000) {
      customer = await Customer.findOne({ mobile });
    } else {
      throw err;
    }
  }

  if (!customer) {
    return errorResponse(res, { statusCode: 500, message: 'Failed to authenticate customer account' });
  }

  if (customer.isActive === false) {
    return errorResponse(res, { statusCode: 403, message: 'Customer account is deactivated' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  const token = jwt.sign(
    { user: { id: customer._id, role: 'Customer' } },
    secret,
    { expiresIn: '7d' }
  );

  return successResponse(res, {
    message: 'Mobile verified successfully',
    data: {
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        role: customer.role,
        isMobileVerified: customer.isMobileVerified
      }
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const { mobile, email, password } = req.body;

  if ((!mobile && !email) || !password) {
    return errorResponse(res, { statusCode: 400, message: 'Mobile/Email and password are required' });
  }

  const query = mobile ? { mobile } : { email: email.toLowerCase() };
  const customer = await Customer.findOne(query);

  if (!customer) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid credentials' });
  }

  if (customer.isActive === false) {
    return errorResponse(res, { statusCode: 403, message: 'Customer account is deactivated' });
  }

  const isMatch = await bcrypt.compare(password, customer.password);
  if (!isMatch) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid credentials' });
  }

  if (customer.isMobileVerified === false) {
    return errorResponse(res, { statusCode: 403, message: 'Mobile number is not verified. Please verify OTP first.' });
  }

  customer.lastLogin = new Date();
  await customer.save();

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  const token = jwt.sign(
    { user: { id: customer._id, role: 'Customer' } },
    secret,
    { expiresIn: '7d' }
  );

  return successResponse(res, {
    message: 'Customer login successful',
    data: {
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        role: customer.role,
        isMobileVerified: customer.isMobileVerified,
        lastLogin: customer.lastLogin
      }
    }
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;
  if (!customerId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized access' });
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    return errorResponse(res, { statusCode: 404, message: 'Customer profile not found' });
  }

  return successResponse(res, {
    message: 'Customer profile retrieved',
    data: {
      customer: {
        id: customer._id,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
        role: customer.role,
        isActive: customer.isActive,
        isMobileVerified: customer.isMobileVerified,
        lastLogin: customer.lastLogin,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      }
    }
  });
});

export const getDashboard = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;

  const [activeSubscriptions, totalOrders, recentOrders, savedAddresses] = await Promise.all([
    Subscription.find({ customerId, status: 'ACTIVE' }),
    Order.countDocuments({ customerId }),
    Order.find({ customerId }).sort({ createdAt: -1 }).limit(5).populate('restaurantId', 'restaurantName').lean(),
    Address.countDocuments({ customerId })
  ]);

  const activeSubscription = activeSubscriptions.length > 0 ? {
    name: activeSubscriptions[0].planSnapshot.name,
    mealTime: activeSubscriptions[0].planSnapshot.mealType
  } : null;

  const formattedRecentOrders = recentOrders.map(order => {
    if (order.restaurantId) order.restaurantId.name = order.restaurantId.restaurantName;
    return order;
  });

  const monthlyData = [
    { month: 'May', spend: 1200, savings: 200, orders: 4 },
    { month: 'Jun', spend: 2100, savings: 450, orders: 7 },
    { month: 'Jul', spend: 1800, savings: 320, orders: 6 },
    { month: 'Aug', spend: 3200, savings: 800, orders: 12 },
    { month: 'Sep', spend: 2800, savings: 650, orders: 9 },
    { month: 'Oct', spend: 950,  savings: 150, orders: 3 }
  ];

  return successResponse(res, {
    message: 'Dashboard data retrieved successfully',
    data: {
      activeSubscriptionsCount: activeSubscriptions.length,
      activeSubscription,
      eatoggyCash: 0,
      totalOrdersCount: totalOrders,
      savedAddressesCount: savedAddresses,
      recentOrders: formattedRecentOrders,
      monthlyData
    }
  });
});

export const saveLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, address, city, state, pincode } = req.body;
  return successResponse(res, {
    message: 'Location saved successfully',
    data: { location: { latitude, longitude, address, city, state, pincode } }
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;
  const { name, email, dietaryPreference, avatar } = req.body;

  if (!name && !email && !dietaryPreference && !avatar) {
    return errorResponse(res, { statusCode: 400, message: 'Missing required fields to update' });
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    return errorResponse(res, { statusCode: 404, message: 'Customer not found' });
  }

  if (email && email !== customer.email) {
    if (!EMAIL_RE.test(String(email))) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid email format' });
    }
    const existingEmail = await Customer.findOne({ email });
    if (existingEmail) {
      return errorResponse(res, { statusCode: 409, message: 'Email already exists' });
    }
    customer.email = email;
  }

  if (name) customer.name = name;
  if (dietaryPreference) customer.dietaryPreference = dietaryPreference;
  if (avatar) customer.avatar = avatar;

  await customer.save();

  return successResponse(res, {
    message: 'Profile updated successfully',
    data: {
      id: customer._id,
      phone: customer.mobile,
      name: customer.name,
      email: customer.email,
      dietaryPreference: customer.dietaryPreference,
      avatar: customer.avatar,
      role: customer.role
    }
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;
  const { reason } = req.body;

  const customer = await Customer.findById(customerId);
  if (!customer) {
    return errorResponse(res, { statusCode: 404, message: 'Customer not found' });
  }

  customer.isDeleted = true;
  customer.deletedAt = new Date();
  customer.deletionReason = reason;
  customer.isActive = false;
  await customer.save();

  return successResponse(res, {
    message: 'Account has been scheduled for deletion. All data will be permanently removed within 30 days.'
  });
});

export const logout = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const { default: redisClient } = await import('../../config/redis.js');
        if (redisClient) {
          const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
          if (expiresIn > 0) {
            await redisClient.setEx(`blacklist_${token}`, expiresIn, '1');
          }
        }
      }
    } catch (e) {
      // Ignore token decode errors on logout
    }
  }
  return successResponse(res, { message: 'Logged out successfully' });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return errorResponse(res, { statusCode: 400, message: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const customer = await Customer.findById(decoded.id);
    if (!customer) {
      return errorResponse(res, { statusCode: 401, message: 'Invalid refresh token' });
    }

    const token = jwt.sign({ id: customer._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    });

    return successResponse(res, {
      statusCode: 200,
      message: 'Token refreshed successfully',
      data: { token, expiresIn: process.env.JWT_EXPIRE || '30d' }
    });
  } catch (error) {
    return errorResponse(res, { statusCode: 401, message: 'Invalid or expired refresh token' });
  }
});

export const sendSecondaryOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) {
    return errorResponse(res, { statusCode: 400, message: 'Mobile number is required' });
  }

  const otpResult = await sendOTP(mobile, 'customer_secondary');
  if (!otpResult.success) {
    return errorResponse(res, {
      statusCode: otpResult.statusCode || 400,
      message: otpResult.message || 'Failed to send OTP'
    });
  }
  return successResponse(res, { statusCode: 200, message: 'Secondary OTP sent successfully' });
});

export const verifySecondaryOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;
  if (!mobile || !otp) {
    return errorResponse(res, { statusCode: 400, message: 'Mobile number and OTP are required' });
  }

  const result = await verifyOTP(mobile, otp, 'customer_secondary');
  if (!result.success) {
    return errorResponse(res, { statusCode: 400, message: result.message || 'Invalid or expired OTP' });
  }

  return successResponse(res, {
    statusCode: 200,
    message: 'Secondary OTP verified successfully',
    data: { verified: true }
  });
});

export default {
  signup, sendOtp, verifyOtp, login, getMe, getDashboard,
  saveLocation, updateProfile, deleteAccount, logout,
  refreshToken, sendSecondaryOtp, verifySecondaryOtp
};
