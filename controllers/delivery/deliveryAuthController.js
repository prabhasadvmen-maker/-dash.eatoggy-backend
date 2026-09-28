import jwt from 'jsonwebtoken';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import { sendOTP, verifyOTP } from '../../integrations/otp/otpService.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

/**
 * @desc    Send OTP to Delivery Partner mobile
 * @route   POST /api/delivery-auth/send-otp
 * @access  Public
 */
export const sendOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Valid 10-digit Indian mobile number is required'
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
 * @desc    Verify mobile OTP for Delivery Partner & return onboarding token + state
 * @route   POST /api/delivery-auth/verify-otp
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

  let partner;
  try {
    partner = await DeliveryPartner.findOne({ mobile });
    if (!partner) {
      partner = await DeliveryPartner.create({
        mobile,
        role: 'DeliveryPartner',
        isActive: false,
        isMobileVerified: true,
        onboardingStatus: 'ONBOARDING_IN_PROGRESS',
        currentStep: 'PROFILE'
      });
    } else {
      partner.isMobileVerified = true;
      if (partner.onboardingStatus === 'DRAFT' || partner.onboardingStatus === 'OTP_VERIFIED') {
        partner.onboardingStatus = 'ONBOARDING_IN_PROGRESS';
        partner.currentStep = partner.currentStep || 'PROFILE';
      }
      partner.lastLogin = new Date();
      await partner.save();
    }
  } catch (err) {
    if (err.code === 11000) {
      partner = await DeliveryPartner.findOne({ mobile });
    } else {
      throw err;
    }
  }

  if (!partner) {
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to authenticate delivery partner account'
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  const token = jwt.sign(
    { user: { id: partner._id, role: 'DeliveryPartner' } },
    secret,
    { expiresIn: '7d' }
  );

  const isProfileComplete = !!(partner.fullName && partner.city && partner.zone && partner.vehicleType);
  const isNewUser = !isProfileComplete;

  return successResponse(res, {
    message: 'Mobile verified successfully',
    data: {
      token,
      isNewUser,
      isProfileComplete,
      partner: {
        id: partner._id,
        mobile: partner.mobile,
        fullName: partner.fullName || null,
        email: partner.email || null,
        city: partner.city || null,
        zone: partner.zone || null,
        vehicleType: partner.vehicleType || 'Bike',
        role: partner.role,
        isActive: partner.isActive,
        isMobileVerified: partner.isMobileVerified,
        onboardingStatus: partner.onboardingStatus,
        currentStep: partner.currentStep || 'PROFILE',
        rejectionReason: partner.rejectionReason || ''
      }
    }
  });
});

/**
 * @desc    [DEPRECATED] Delivery Partner Login via Password - Password authentication disabled
 * @route   POST /api/delivery-auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  return errorResponse(res, {
    statusCode: 400,
    message: 'Password authentication is disabled for Delivery Partners. Please use Mobile + OTP authentication.'
  });
});

/**
 * @desc    Get Current Authenticated Delivery Partner Profile
 * @route   GET /api/delivery-auth/me
 * @access  Protected (Delivery Partner JWT)
 */
export const getMe = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;
  if (!partnerId) {
    return errorResponse(res, {
      statusCode: 401,
      message: 'Unauthorized access'
    });
  }

  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner profile not found'
    });
  }

  return successResponse(res, {
    message: 'Delivery partner profile retrieved',
    data: {
      partner: {
        id: partner._id,
        fullName: partner.fullName,
        mobile: partner.mobile,
        email: partner.email,
        city: partner.city,
        zone: partner.zone,
        selectedAddress: partner.selectedAddress,
        latitude: partner.latitude,
        longitude: partner.longitude,
        vehicleType: partner.vehicleType,
        role: partner.role,
        isActive: partner.isActive,
        isMobileVerified: partner.isMobileVerified,
        onboardingStatus: partner.onboardingStatus,
        currentStep: partner.currentStep || 'PROFILE',
        rejectionReason: partner.rejectionReason,
        createdAt: partner.createdAt,
        updatedAt: partner.updatedAt
      }
    }
  });
});
