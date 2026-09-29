import Payment from '../../models/payments/Payment.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getAllRefunds = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;

  const query = { status: 'REFUNDED' };
  
  if (search) {
    query.$or = [
      { razorpayOrderId: { $regex: search, $options: 'i' } },
      { razorpayPaymentId: { $regex: search, $options: 'i' } }
    ];
  }

  const refunds = await Payment.find(query)
    .populate('customer', 'name mobile')
    .populate('restaurant', 'restaurantName mobile')
    .sort({ 'refundDetails.refundedAt': -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Payment.countDocuments(query);

  return successResponse(res, {
    message: 'Refunds retrieved successfully',
    data: {
      refunds,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

export const getPendingRefunds = asyncHandler(async (req, res) => {
  // Find payments that are PAID, have refundDetails initiated but no refundId yet, 
  // or use a separate flag if present. For now, assuming refundDetails exists means it's a request.
  const query = {
    status: 'PAID',
    'refundDetails.reason': { $exists: true }
  };

  const pendingRefunds = await Payment.find(query)
    .populate('customer', 'name mobile')
    .populate('restaurant', 'restaurantName mobile')
    .sort({ createdAt: -1 });

  return successResponse(res, {
    message: 'Pending refunds retrieved successfully',
    data: { pendingRefunds }
  });
});

export const processRefund = asyncHandler(async (req, res) => {
  const { refundAmount, reason } = req.body;
  
  if (!refundAmount || !reason) {
    return errorResponse(res, { statusCode: 400, message: 'Refund amount and reason are required' });
  }

  // Prevent race conditions by strictly looking for status: PAID
  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, status: 'PAID' },
    {
      $set: {
        status: 'REFUNDED',
        refundDetails: {
          refundedAt: new Date(),
          refundAmount,
          reason,
          refundId: `rfnd_${Date.now()}`
        }
      }
    },
    { new: true }
  );

  if (!payment) {
    return errorResponse(res, { 
      statusCode: 404, 
      message: 'Payment not found or already processed for refund' 
    });
  }

  return successResponse(res, {
    message: 'Refund processed successfully',
    data: { payment }
  });
});
