import Settlement from '../../models/settlements/Settlement.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getAllSettlements = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, entityType, settlementNumber } = req.query;

  const query = {};
  if (status) query.status = status;
  if (entityType) query.entityType = entityType;
  if (settlementNumber) query.settlementNumber = { $regex: settlementNumber, $options: 'i' };

  const settlements = await Settlement.find(query)
    .populate('restaurantId', 'restaurantName mobile')
    .populate('deliveryPartnerId', 'fullName mobile')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Settlement.countDocuments(query);

  return successResponse(res, {
    message: 'Settlements retrieved successfully',
    data: {
      settlements,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

export const getSettlementById = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findById(req.params.id)
    .populate('restaurantId', 'restaurantName mobile')
    .populate('deliveryPartnerId', 'fullName mobile');

  if (!settlement) {
    return errorResponse(res, { statusCode: 404, message: 'Settlement not found' });
  }

  return successResponse(res, {
    message: 'Settlement retrieved successfully',
    data: { settlement }
  });
});

export const markSettlementPaid = asyncHandler(async (req, res) => {
  const { transactionReference } = req.body;
  if (!transactionReference) {
    return errorResponse(res, { statusCode: 400, message: 'Transaction reference is required' });
  }

  const settlement = await Settlement.findById(req.params.id);
  if (!settlement) {
    return errorResponse(res, { statusCode: 404, message: 'Settlement not found' });
  }

  settlement.status = 'PAID';
  settlement.paidAt = new Date();
  settlement.transactionReference = transactionReference;
  await settlement.save();

  return successResponse(res, {
    message: 'Settlement marked as paid successfully',
    data: { settlement }
  });
});

export const markSettlementFailed = asyncHandler(async (req, res) => {
  const { failureReason } = req.body;
  if (!failureReason) {
    return errorResponse(res, { statusCode: 400, message: 'Failure reason is required' });
  }

  const settlement = await Settlement.findById(req.params.id);
  if (!settlement) {
    return errorResponse(res, { statusCode: 404, message: 'Settlement not found' });
  }

  settlement.status = 'FAILED';
  settlement.failureReason = failureReason;
  await settlement.save();

  return successResponse(res, {
    message: 'Settlement marked as failed successfully',
    data: { settlement }
  });
});
