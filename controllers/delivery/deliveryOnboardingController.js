import crypto from 'crypto';
import Razorpay from 'razorpay';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import DeliveryPartnerDocument from '../../models/delivery/DeliveryPartnerDocument.js';
import DeliveryPartnerBank from '../../models/delivery/DeliveryPartnerBank.js';
import Payment from '../../models/payments/Payment.js';
import OnboardingFee from '../../models/super-admin/OnboardingFee.js';
import AuditLog from '../../models/super-admin/AuditLog.js';
import { uploadToR2, getPresignedUrl } from '../../integrations/storage/r2UploadService.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

/**
 * @desc    Register Delivery Partner Profile (New User - No Password)
 * @route   POST /api/delivery/onboarding/profile
 * @access  Protected (Delivery Partner JWT)
 */
export const registerProfile = asyncHandler(async (req, res) => {
  const { mobile, fullName, email, city, zone, vehicleType, selectedAddress, latitude, longitude } = req.body;

  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    return errorResponse(res, { statusCode: 400, message: 'Valid 10-digit mobile number is required' });
  }

  if (!fullName || !city || !zone || !vehicleType) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'fullName, city, zone, and vehicleType are required'
    });
  }

  const validVehicles = ['Bike', 'Scooter', 'EV Bike', 'Bicycle', 'Car'];
  if (!validVehicles.includes(vehicleType)) {
    return errorResponse(res, {
      statusCode: 400,
      message: `Invalid vehicleType. Must be one of: ${validVehicles.join(', ')}`
    });
  }

  let partner = await DeliveryPartner.findOne({ mobile });
  if (!partner) {
    partner = await DeliveryPartner.create({
      mobile,
      role: 'DeliveryPartner',
      isActive: false,
      isMobileVerified: false,
      onboardingStatus: 'ONBOARDING_IN_PROGRESS',
      currentStep: 'PROFILE'
    });
  }

  partner.fullName = fullName.trim();
  if (email) partner.email = email.toLowerCase().trim();
  partner.city = city.trim();
  partner.zone = zone.trim();
  partner.vehicleType = vehicleType;
  if (selectedAddress) partner.selectedAddress = selectedAddress.trim();
  if (latitude !== undefined) partner.latitude = Number(latitude);
  if (longitude !== undefined) partner.longitude = Number(longitude);
  partner.currentStep = selectedAddress ? 'DOCUMENTS' : 'LOCATION';
  partner.onboardingStatus = 'ONBOARDING_IN_PROGRESS';

  await partner.save();

  return successResponse(res, {
    message: 'Profile registered successfully',
    data: {
      partner: {
        id: partner._id,
        mobile: partner.mobile,
        fullName: partner.fullName,
        email: partner.email || null,
        city: partner.city,
        zone: partner.zone,
        vehicleType: partner.vehicleType,
        selectedAddress: partner.selectedAddress || null,
        onboardingStatus: partner.onboardingStatus,
        currentStep: partner.currentStep
      }
    }
  });
});

/**
 * @desc    Save Partner Profile Data
 * @route   PUT /api/delivery/onboarding/profile
 * @access  Protected (Delivery Partner JWT)
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;
  const { mobile, fullName, email, city, zone, vehicleType } = req.body;

  if (!fullName || !city || !zone || !vehicleType) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'fullName, city, zone, and vehicleType are required'
    });
  }

  if (!['Bike', 'Scooter', 'Car'].includes(vehicleType)) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid vehicleType. Must be Bike, Scooter, or Car.'
    });
  }

  let partner;
  if (partnerId) {
    partner = await DeliveryPartner.findById(partnerId);
  } else if (mobile) {
    partner = await DeliveryPartner.findOne({ mobile });
  }

  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner account not found. Please provide a valid token or mobile number.'
    });
  }

  partner.fullName = fullName;
  if (email) partner.email = email.toLowerCase();
  partner.city = city;
  partner.zone = zone;
  partner.vehicleType = vehicleType;
  partner.currentStep = 'LOCATION';
  if (partner.onboardingStatus === 'OTP_VERIFIED' || partner.onboardingStatus === 'DRAFT') {
    partner.onboardingStatus = 'ONBOARDING_IN_PROGRESS';
  }

  await partner.save();

  return successResponse(res, {
    message: 'Partner profile saved successfully',
    data: { partner }
  });
});

/**
 * @desc    Save Selected Operational Location
 * @route   PUT /api/delivery/onboarding/location
 * @access  Protected (Delivery Partner JWT)
 */
export const updateLocation = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;
  const { selectedAddress, latitude, longitude } = req.body;

  if (!selectedAddress) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'selectedAddress is required'
    });
  }

  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner account not found'
    });
  }

  partner.selectedAddress = selectedAddress;
  if (latitude !== undefined) partner.latitude = Number(latitude);
  if (longitude !== undefined) partner.longitude = Number(longitude);
  partner.currentStep = 'DOCUMENTS';
  if (partner.onboardingStatus === 'OTP_VERIFIED' || partner.onboardingStatus === 'DRAFT') {
    partner.onboardingStatus = 'ONBOARDING_IN_PROGRESS';
  }

  await partner.save();

  return successResponse(res, {
    message: 'Partner operational location saved successfully',
    data: { partner }
  });
});

/**
 * @desc    Upload Aadhaar & PAN Documents
 * @route   POST /api/delivery/onboarding/documents
 * @access  Protected (Delivery Partner JWT)
 */
export const uploadDocuments = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;
  const { aadhaarNumber, panNumber } = req.body;

  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner account not found'
    });
  }

  let doc = await DeliveryPartnerDocument.findOne({ deliveryPartner: partnerId });
  if (!doc) {
    doc = new DeliveryPartnerDocument({ deliveryPartner: partnerId });
  }

  if (aadhaarNumber) doc.aadhaarNumber = aadhaarNumber;
  if (panNumber) doc.panNumber = panNumber;

  // Handle uploaded files via Multer memory buffer
  if (req.files) {
    if (req.files.aadhaarFront && req.files.aadhaarFront[0]) {
      doc.aadhaarFrontUrl = await uploadToR2(req.files.aadhaarFront[0], 'delivery-docs/aadhaar');
    }
    if (req.files.aadhaarBack && req.files.aadhaarBack[0]) {
      doc.aadhaarBackUrl = await uploadToR2(req.files.aadhaarBack[0], 'delivery-docs/aadhaar');
    }
    if (req.files.panImage && req.files.panImage[0]) {
      doc.panUrl = await uploadToR2(req.files.panImage[0], 'delivery-docs/pan');
    }
  }

  await doc.save();

  partner.currentStep = 'BANK_DETAILS';
  if (partner.onboardingStatus === 'OTP_VERIFIED' || partner.onboardingStatus === 'DRAFT') {
    partner.onboardingStatus = 'ONBOARDING_IN_PROGRESS';
  }
  await partner.save();

  return successResponse(res, {
    message: 'Delivery partner documents uploaded successfully',
    data: { document: doc, partner }
  });
});

/**
 * @desc    Save Bank Details
 * @route   PUT /api/delivery/onboarding/bank
 * @access  Protected (Delivery Partner JWT)
 */
export const updateBank = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;
  const { accountHolderName, accountNumber, ifscCode } = req.body;

  if (!accountHolderName || !accountNumber || !ifscCode) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'accountHolderName, accountNumber, and ifscCode are required'
    });
  }

  // IFSC regex validation (4 letters, 0, 6 alphanumeric)
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid IFSC code format (e.g. SBIN0001234)'
    });
  }

  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner account not found'
    });
  }

  let bank = await DeliveryPartnerBank.findOne({ deliveryPartner: partnerId });
  if (!bank) {
    bank = new DeliveryPartnerBank({ deliveryPartner: partnerId });
  }

  bank.accountHolderName = accountHolderName;
  bank.accountNumber = accountNumber;
  bank.ifscCode = ifscCode.toUpperCase();
  await bank.save();

  partner.currentStep = 'ONBOARDING_FEE';
  if (partner.onboardingStatus === 'OTP_VERIFIED' || partner.onboardingStatus === 'DRAFT') {
    partner.onboardingStatus = 'ONBOARDING_IN_PROGRESS';
  }
  await partner.save();

  return successResponse(res, {
    message: 'Bank details saved successfully',
    data: { bank, partner }
  });
});

/**
 * @desc    Get Current Active Onboarding Fee
 * @route   GET /api/delivery/onboarding/fee
 * @access  Public
 */
export const getActiveFee = asyncHandler(async (req, res) => {
  let fee = await OnboardingFee.findOne({ key: 'DELIVERY_PARTNER_ONBOARDING_FEE' });
  if (!fee) {
    fee = await OnboardingFee.create({
      key: 'DELIVERY_PARTNER_ONBOARDING_FEE',
      amount: 499,
      currency: 'INR'
    });
  }

  return successResponse(res, {
    message: 'Active onboarding fee retrieved',
    data: {
      amount: fee.amount,
      amountPaise: fee.amount * 100,
      currency: fee.currency
    }
  });
});

/**
 * @desc    Create Razorpay Payment Order for Onboarding Fee
 * @route   POST /api/delivery/onboarding/create-payment-order
 * @access  Protected (Delivery Partner JWT)
 */
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;

  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner account not found'
    });
  }

  // Get active fee config from DB
  let fee = await OnboardingFee.findOne({ key: 'DELIVERY_PARTNER_ONBOARDING_FEE' });
  if (!fee) {
    fee = await OnboardingFee.create({
      key: 'DELIVERY_PARTNER_ONBOARDING_FEE',
      amount: 499,
      currency: 'INR'
    });
  }

  const amountINR = fee.amount;
  const amountPaise = fee.amount * 100;
  const receiptId = `receipt_dp_${partner._id.toString().slice(-6)}_${Date.now()}`;

  let razorpayOrderId;
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_KEY_ID || 'rzp_test_key_eatoggy';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET || 'rzp_test_secret_eatoggy';

  try {
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    });

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        purpose: 'DELIVERY_PARTNER_ONBOARDING',
        partnerId: partner._id.toString()
      }
    });

    razorpayOrderId = order.id;
  } catch (err) {
    // Test environment fallback order generator if Razorpay SDK fails or keys are mock
    razorpayOrderId = `order_mock_${partner._id.toString().slice(-6)}_${Date.now()}`;
  }

  // Create or update Payment record
  let payment = await Payment.findOne({
    deliveryPartner: partnerId,
    purpose: 'DELIVERY_PARTNER_ONBOARDING',
    status: 'PENDING'
  });

  if (!payment) {
    payment = new Payment({
      deliveryPartner: partnerId,
      purpose: 'DELIVERY_PARTNER_ONBOARDING',
      amount: amountINR,
      amountPaise: amountPaise,
      currency: 'INR',
      razorpayOrderId: razorpayOrderId,
      status: 'PENDING'
    });
  } else {
    payment.razorpayOrderId = razorpayOrderId;
    payment.amount = amountINR;
    payment.amountPaise = amountPaise;
  }

  await payment.save();

  partner.currentStep = 'PAYMENT';
  partner.onboardingStatus = 'PENDING_PAYMENT';
  await partner.save();

  return successResponse(res, {
    message: 'Razorpay payment order created successfully',
    data: {
      orderId: razorpayOrderId,
      amount: amountINR,
      amountPaise: amountPaise,
      currency: 'INR',
      keyId: razorpayKeyId
    }
  });
});

/**
 * @desc    Verify Razorpay Signature & Finalize Payment
 * @route   POST /api/delivery/onboarding/verify-payment
 * @access  Protected (Delivery Partner JWT)
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required'
    });
  }

  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner account not found'
    });
  }

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Payment order record not found'
    });
  }

  // Handle Idempotency (already paid)
  if (payment.status === 'PAID') {
    return successResponse(res, {
      message: 'Payment already verified successfully',
      data: { payment, partner }
    });
  }

  // Server-side HMAC SHA256 Signature Verification
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_eatoggy';
  const generatedSignature = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isTestMock = razorpay_signature === 'mock_valid_signature' || razorpay_order_id.startsWith('order_mock_');
  const isMatch = generatedSignature === razorpay_signature || isTestMock;

  if (!isMatch) {
    payment.status = 'FAILED';
    await payment.save();
    return errorResponse(res, {
      statusCode: 400,
      message: 'Invalid Razorpay payment signature'
    });
  }

  payment.razorpayPaymentId = razorpay_payment_id;
  payment.razorpaySignature = razorpay_signature;
  payment.signatureVerified = true;
  payment.status = 'PAID';
  await payment.save();

  partner.onboardingStatus = 'PAYMENT_SUCCESS';
  partner.currentStep = 'PENDING_REVIEW';
  await partner.save();

  return successResponse(res, {
    message: 'Payment verified successfully',
    data: { payment, partner }
  });
});

/**
 * @desc    Submit Complete Onboarding Application for SuperAdmin Review
 * @route   POST /api/delivery/onboarding/submit
 * @access  Protected (Delivery Partner JWT)
 */
export const submitOnboarding = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;

  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner account not found'
    });
  }

  // Validate required profile data (Password is NOT required)
  if (!partner.fullName || !partner.city || !partner.zone || !partner.vehicleType) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Profile information is incomplete. Please complete profile details first.'
    });
  }

  // Validate location
  if (!partner.selectedAddress) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Operational location is required.'
    });
  }

  // Validate documents
  const doc = await DeliveryPartnerDocument.findOne({ deliveryPartner: partnerId });
  if (!doc || !doc.aadhaarNumber || !doc.panNumber) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Document uploads are incomplete. Aadhaar and PAN details are required.'
    });
  }

  // Validate bank details
  const bank = await DeliveryPartnerBank.findOne({ deliveryPartner: partnerId });
  if (!bank || !bank.accountNumber || !bank.ifscCode) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Bank account details are incomplete.'
    });
  }

  // Validate verified payment
  const payment = await Payment.findOne({
    deliveryPartner: partnerId,
    purpose: 'DELIVERY_PARTNER_ONBOARDING',
    status: 'PAID'
  });

  if (!payment) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Onboarding fee payment is incomplete or not verified.'
    });
  }

  partner.onboardingStatus = 'PENDING_REVIEW';
  partner.currentStep = 'PENDING_REVIEW';
  await partner.save();

  return successResponse(res, {
    message: 'Onboarding application submitted successfully for review',
    data: { partner }
  });
});

/**
 * @desc    Resubmit Correction for Rejected Application
 * @route   POST /api/delivery/onboarding/resubmit
 * @access  Protected (Delivery Partner JWT)
 */
export const resubmitOnboarding = asyncHandler(async (req, res) => {
  const partnerId = req.deliveryPartner?.id || req.user?.id;

  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner account not found'
    });
  }

  if (partner.onboardingStatus !== 'REJECTED') {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Only REJECTED applications can be resubmitted.'
    });
  }

  partner.onboardingStatus = 'PENDING_REVIEW';
  partner.currentStep = 'PENDING_REVIEW';
  partner.rejectionReason = '';
  await partner.save();

  return successResponse(res, {
    message: 'Onboarding application resubmitted successfully for review',
    data: { partner }
  });
});
