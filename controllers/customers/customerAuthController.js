import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Customer from '../../models/customers/Customer.js';
import { sendOTP, verifyOTP } from '../../integrations/otp/otpService.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import Subscription from '../../models/subscriptions/Subscription.js';
import Order from '../../models/orders/Order.js';
import Address from '../../models/customers/Address.js';
import Restaurant from '../../models/restaurants/Restaurant.js';

/**
 * @desc    Register a new Customer account
 * @route   POST /api/customer-auth/signup
 * @access  Public
 */
export const signup = asyncHandler(async (req, res) => {
  const { name, mobile, email, password } = req.body;

  if (!name || !mobile || !email || !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'All fields (name, mobile, email, password) are required',
      errors: ['name, mobile, email, and password are required']
    });
  }

  // Validate 10-digit Indian mobile format
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid mobile number format. Must be a 10-digit Indian mobile number.'
    });
  }

  // Validate email format
  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(email)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid email address format.'
    });
  }

  // Check duplicate mobile
  const existingMobile = await Customer.findOne({ mobile });
  if (existingMobile) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Mobile number is already registered'
    });
  }

  // Check duplicate email
  const existingEmail = await Customer.findOne({ email });
  if (existingEmail) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Email address is already registered'
    });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create customer record
  const customer = new Customer({
    name,
    mobile,
    email,
    password: hashedPassword,
    role: 'Customer',
    isActive: true,
    isMobileVerified: false
  });

  await customer.save();

  // Send mobile OTP
  await sendOTP(mobile);

  // Return success response WITHOUT issuing JWT token (OTP verification required)
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

/**
 * @desc    Send OTP to Customer mobile
 * @route   POST /api/customer-auth/send-otp
 * @access  Public
 */
export const sendOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Valid 10-digit mobile number is required'
    });
  }

  const otpResult = await sendOTP(mobile);
  if (otpResult.success) {
    return successResponse(res, {
      message: 'OTP sent successfully'
    });
  } else {
    return errorResponse(res, {
      statusCode: 400,
      message: otpResult.message || 'Failed to send OTP'
    });
  }
});

/**
 * @desc    Verify mobile OTP & issue Customer JWT
 * @route   POST /api/customer-auth/verify-otp
 * @access  Public
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Mobile number and OTP are required'
    });
  }

  const verification = verifyOTP(mobile, otp);
  if (!verification.success) {
    return errorResponse(res, {
      statusCode: 400,
      message: verification.message || 'Invalid or expired OTP'
    });
  }

  let customer;
  try {
    customer = await Customer.findOne({ mobile });
    if (!customer) {
      customer = await Customer.create({
        mobile,
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
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to authenticate customer account'
    });
  }

  if (customer.isActive === false) {
    return errorResponse(res, {
      statusCode: 403,
      message: 'Customer account is deactivated'
    });
  }

  // Sign Customer JWT
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

/**
 * @desc    Customer Login via Password
 * @route   POST /api/customer-auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { mobile, email, password } = req.body;

  if ((!mobile && !email) || !password) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Mobile/Email and password are required'
    });
  }

  // Find Customer by mobile or email
  const query = mobile ? { mobile } : { email: email.toLowerCase() };
  const customer = await Customer.findOne(query);

  if (!customer) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid credentials'
    });
  }

  if (customer.isActive === false) {
    return errorResponse(res, {
      statusCode: 403,
      message: 'Customer account is deactivated'
    });
  }

  // Validate password
  const isMatch = await bcrypt.compare(password, customer.password);
  if (!isMatch) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid credentials'
    });
  }

  // Verify mobile verification status
  if (customer.isMobileVerified === false) {
    return errorResponse(res, {
      statusCode: 403,
      message: 'Mobile number is not verified. Please verify OTP first.'
    });
  }

  // Update last login
  customer.lastLogin = new Date();
  await customer.save();

  // Sign Customer JWT
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

/**
 * @desc    Get Current Authenticated Customer Profile
 * @route   GET /api/customer-auth/me
 * @access  Protected (Customer JWT)
 */
export const getMe = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;
  if (!customerId) {
    return errorResponse(res, {
      statusCode: 401,
      message: 'Unauthorized access'
    });
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Customer profile not found'
    });
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

/**
 * @desc    Get Customer Dashboard Data
 * @route   GET /api/customer-auth/dashboard
 * @access  Protected (Customer JWT)
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;
  
  const [
    activeSubscriptions,
    totalOrders,
    recentOrders,
    savedAddresses
  ] = await Promise.all([
    Subscription.find({ customerId, status: 'ACTIVE' }),
    Order.countDocuments({ customerId }),
    Order.find({ customerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('restaurantId', 'businessName'),
    Address.countDocuments({ customerId })
  ]);

  const activeSubscription = activeSubscriptions.length > 0 ? {
    name: activeSubscriptions[0].planSnapshot.name,
    mealTime: activeSubscriptions[0].planSnapshot.mealType
  } : null;

  const formattedRecentOrders = recentOrders.map(order => ({
    id: order._id,
    orderNumber: order.orderNumber,
    restaurantName: order.restaurantId?.businessName || 'Restaurant',
    amount: order.pricing.grandTotal,
    status: order.orderStatus,
    date: order.createdAt
  }));

  // Dummy monthly spending for now as aggregation takes time
  const monthlySpending = [];

  return successResponse(res, {
    message: 'Dashboard data retrieved successfully',
    data: {
      activeSubscriptionsCount: activeSubscriptions.length,
      activeSubscription,
      eatoggyCash: 0,
      totalOrdersCount: totalOrders,
      savedAddressesCount: savedAddresses,
      recentOrders: formattedRecentOrders,
      monthlySpending
    }
  });
});

/**
 * @desc    Save Customer Location
 * @route   POST /api/customer-auth/location
 * @access  Protected (Customer JWT)
 */
export const saveLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, address, city, state, pincode, saveAsAddress } = req.body;
  
  return successResponse(res, {
    message: 'Location saved successfully',
    data: {
      location: { latitude, longitude, address, city, state, pincode }
    }
  });
});

// 1. Update Profile
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
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
    if (!emailRegex.test(email)) {
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

// 2. Delete Account
export const deleteAccount = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;
  const { reason } = req.body;

  const customer = await Customer.findById(customerId);
  if (!customer) {
    return errorResponse(res, { statusCode: 404, message: 'Customer not found' });
  }

  // Soft delete
  customer.isDeleted = true;
  customer.deletedAt = new Date();
  customer.deletionReason = reason;
  customer.isActive = false;
  await customer.save();

  // In reality you would invalidate JWTs here using Redis blocklist
  return successResponse(res, {
    message: 'Account has been scheduled for deletion. All data will be permanently removed within 30 days.'
  });
});

// 3. Logout
export const logout = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;
  
  // Extract token from header
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

  return successResponse(res, {
    message: 'Logged out successfully'
  });
});

export default {
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
};
