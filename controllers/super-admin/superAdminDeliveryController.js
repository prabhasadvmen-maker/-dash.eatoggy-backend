import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import DeliveryPartnerDocument from '../../models/delivery/DeliveryPartnerDocument.js';
import DeliveryPartnerBank from '../../models/delivery/DeliveryPartnerBank.js';
import Payment from '../../models/payments/Payment.js';
import OnboardingFee from '../../models/super-admin/OnboardingFee.js';
import AuditLog from '../../models/super-admin/AuditLog.js';
import { getPresignedUrl } from '../../integrations/storage/r2UploadService.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

/**
 * @desc    Get List of Delivery Partner Applications with status filter & search
 * @route   GET /api/super-admin/delivery-partners
 * @access  Protected (SuperAdmin JWT)
 */
export const getDeliveryPartners = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const query = {};

  if (status && status !== 'ALL') {
    query.onboardingStatus = status;
  }

  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const partners = await DeliveryPartner.find(query).sort({ updatedAt: -1 });

  const allPartners = await DeliveryPartner.find({});
  const statusCounts = {
    ALL: allPartners.length,
    PENDING_REVIEW: allPartners.filter(p => p.onboardingStatus === 'PENDING_REVIEW' || p.onboardingStatus === 'ONBOARDING_IN_PROGRESS' || p.onboardingStatus === 'PENDING_PAYMENT' || p.onboardingStatus === 'PAYMENT_SUCCESS' || p.onboardingStatus === 'DRAFT' || p.onboardingStatus === 'OTP_VERIFIED').length,
    APPROVED: allPartners.filter(p => p.onboardingStatus === 'APPROVED').length,
    REJECTED: allPartners.filter(p => p.onboardingStatus === 'REJECTED' || p.onboardingStatus === 'BLOCKED').length
  };

  return successResponse(res, {
    message: 'Delivery partner applications retrieved',
    data: { partners, statusCounts }
  });
});

/**
 * @desc    Get Single Delivery Partner Application Details (with signed docs & masked bank)
 * @route   GET /api/super-admin/delivery-partners/:id
 * @access  Protected (SuperAdmin JWT)
 */
export const getDeliveryPartnerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const partner = await DeliveryPartner.findById(id);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner application not found'
    });
  }

  const doc = await DeliveryPartnerDocument.findOne({ deliveryPartner: id });
  const bank = await DeliveryPartnerBank.findOne({ deliveryPartner: id });
  const payment = await Payment.findOne({
    deliveryPartner: id,
    purpose: 'DELIVERY_PARTNER_ONBOARDING',
    status: 'PAID'
  });

  // Presign document URLs if present
  let signedDoc = null;
  if (doc) {
    signedDoc = {
      id: doc._id,
      aadhaarNumber: doc.aadhaarNumber,
      aadhaarFrontUrl: doc.aadhaarFrontUrl ? await getPresignedUrl(doc.aadhaarFrontUrl) : null,
      aadhaarBackUrl: doc.aadhaarBackUrl ? await getPresignedUrl(doc.aadhaarBackUrl) : null,
      panNumber: doc.panNumber,
      panUrl: doc.panUrl ? await getPresignedUrl(doc.panUrl) : null,
      verificationStatus: doc.verificationStatus
    };
  }

  // Mask bank account number (show last 4 digits only)
  let maskedBank = null;
  if (bank) {
    const accNum = bank.accountNumber || '';
    const maskedAcc = accNum.length > 4 ? `••••••••${accNum.slice(-4)}` : accNum;
    maskedBank = {
      accountHolderName: bank.accountHolderName,
      accountNumberMasked: maskedAcc,
      ifscCode: bank.ifscCode
    };
  }

  return successResponse(res, {
    message: 'Delivery partner application details retrieved',
    data: {
      partner,
      document: signedDoc,
      bank: maskedBank,
      payment: payment ? {
        amount: payment.amount,
        currency: payment.currency,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: payment.razorpayPaymentId,
        signatureVerified: payment.signatureVerified,
        status: payment.status,
        updatedAt: payment.updatedAt
      } : null
    }
  });
});

/**
 * @desc    Approve Delivery Partner Application
 * @route   PATCH /api/super-admin/delivery-partners/:id/approve
 * @access  Protected (SuperAdmin JWT)
 */
export const approveDeliveryPartner = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.admin?.id;

  const partner = await DeliveryPartner.findById(id);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner application not found'
    });
  }

  partner.onboardingStatus = 'APPROVED';
  partner.currentStep = 'APPROVED';
  partner.isActive = true;
  partner.rejectionReason = '';
  await partner.save();

  // Audit Log
  await AuditLog.create({
    action: 'DELIVERY_PARTNER_APPROVED',
    performedBy: adminId,
    targetId: partner._id,
    targetModel: 'DeliveryPartner',
    details: { mobile: partner.mobile, fullName: partner.fullName }
  });

  return successResponse(res, {
    message: 'Delivery partner application approved successfully',
    data: { partner }
  });
});

/**
 * @desc    Reject Delivery Partner Application with Reason
 * @route   PATCH /api/super-admin/delivery-partners/:id/reject
 * @access  Protected (SuperAdmin JWT)
 */
export const rejectDeliveryPartner = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.admin?.id;

  if (!reason || reason.trim() === '') {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Rejection reason is required'
    });
  }

  const partner = await DeliveryPartner.findById(id);
  if (!partner) {
    return errorResponse(res, {
      statusCode: 404,
      message: 'Delivery partner application not found'
    });
  }

  partner.onboardingStatus = 'REJECTED';
  partner.currentStep = 'REJECTED';
  partner.isActive = false;
  partner.rejectionReason = reason.trim();
  await partner.save();

  // Audit Log
  await AuditLog.create({
    action: 'DELIVERY_PARTNER_REJECTED',
    performedBy: adminId,
    targetId: partner._id,
    targetModel: 'DeliveryPartner',
    details: { mobile: partner.mobile, reason: partner.rejectionReason }
  });

  return successResponse(res, {
    message: 'Delivery partner application rejected successfully',
    data: { partner }
  });
});

/**
 * @desc    Get Current Active Onboarding Fee Setting
 * @route   GET /api/super-admin/delivery-partners/onboarding-fee
 * @access  Protected (SuperAdmin JWT)
 */
export const getFeeSetting = asyncHandler(async (req, res) => {
  let fee = await OnboardingFee.findOne({ key: 'DELIVERY_PARTNER_ONBOARDING_FEE' });
  if (!fee) {
    fee = await OnboardingFee.create({
      key: 'DELIVERY_PARTNER_ONBOARDING_FEE',
      amount: 499,
      currency: 'INR'
    });
  }

  return successResponse(res, {
    message: 'Onboarding fee setting retrieved',
    data: { fee }
  });
});

/**
 * @desc    Update Onboarding Fee Setting
 * @route   PUT /api/super-admin/delivery-partners/onboarding-fee
 * @access  Protected (SuperAdmin JWT)
 */
export const updateFeeSetting = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const adminId = req.admin?.id;

  if (amount === undefined || isNaN(amount) || Number(amount) < 0) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Valid non-negative fee amount is required'
    });
  }

  let fee = await OnboardingFee.findOne({ key: 'DELIVERY_PARTNER_ONBOARDING_FEE' });
  const oldAmount = fee ? fee.amount : 499;

  if (!fee) {
    fee = new OnboardingFee({ key: 'DELIVERY_PARTNER_ONBOARDING_FEE' });
  }

  fee.amount = Number(amount);
  fee.currency = 'INR';
  fee.updatedBy = adminId;
  await fee.save();

  // Audit Log
  await AuditLog.create({
    action: 'ONBOARDING_FEE_UPDATED',
    performedBy: adminId,
    targetId: fee._id,
    targetModel: 'OnboardingFee',
    details: { oldAmount, newAmount: fee.amount }
  });

  return successResponse(res, {
    message: 'Onboarding fee updated successfully',
    data: { fee }
  });
});
