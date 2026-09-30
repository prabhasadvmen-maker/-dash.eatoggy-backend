import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getWallet = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Wallet retrieved successfully',
    data: { balance: 0, transactions: [], pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 } }
  });
});

export const addMoney = asyncHandler(async (req, res) => {
  const { amount, paymentMethod } = req.body;
  return successResponse(res, {
    statusCode: 200,
    message: 'Money added successfully',
    data: { transactionId: 'TXN123', newBalance: amount }
  });
});
