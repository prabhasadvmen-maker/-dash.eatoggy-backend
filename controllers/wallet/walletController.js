import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import Wallet from '../../models/wallet/Wallet.js';
import Transaction from '../../models/wallet/Transaction.js';

export const getRestaurantWallet = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  let wallet = await Wallet.findOne({ restaurantId });
  if (!wallet) {
    wallet = await Wallet.create({ restaurantId });
  }

  return successResponse(res, {
    statusCode: 200,
    message: 'Wallet details retrieved successfully',
    data: {
      walletId: wallet._id,
      restaurantId: wallet.restaurantId,
      currentBalance: wallet.currentBalance,
      totalEarnings: wallet.totalEarnings,
      totalWithdrawals: wallet.totalWithdrawals,
      pendingAmount: wallet.pendingAmount,
      lastSettlementDate: wallet.lastSettlementDate,
      lastSettlementAmount: wallet.lastSettlementAmount
    }
  });
});

export const getWalletTransactions = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  const { page = 1, limit = 20, type, dateFrom, dateTo } = req.query;
  const query = { restaurantId };

  if (type && type !== 'ALL') {
    query.type = type;
  }

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitVal = parseInt(limit);

  const [transactions, total] = await Promise.all([
    Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitVal),
    Transaction.countDocuments(query)
  ]);

  return successResponse(res, {
    statusCode: 200,
    message: 'Wallet transactions retrieved successfully',
    data: {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: limitVal,
        total,
        totalPages: Math.ceil(total / limitVal)
      }
    }
  });
});

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

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid withdrawal amount' });
  }

  const Restaurant = (await import('../../models/restaurants/Restaurant.js')).default;
  const restaurant = await Restaurant.findById(restaurantId);
  
  if (!restaurant || !restaurant.bankDetails || !restaurant.bankDetails.accountNumber) {
    return errorResponse(res, { statusCode: 400, message: 'Verified bank account is required for withdrawal' });
  }

  let wallet = await Wallet.findOne({ restaurantId });
  if (!wallet || wallet.currentBalance < amount) {
    return errorResponse(res, { statusCode: 400, message: 'Insufficient wallet balance' });
  }

  // Create withdrawal transaction record
  const transaction = await Transaction.create({
    walletId: wallet._id,
    restaurantId,
    type: 'WITHDRAWAL',
    amount,
    status: 'PROCESSING',
    reference: `WD-${Date.now()}`
  });

  wallet.currentBalance -= amount;
  wallet.pendingAmount = (wallet.pendingAmount || 0) + amount;
  await wallet.save();

  const estimatedSettlementDate = new Date();
  estimatedSettlementDate.setDate(estimatedSettlementDate.getDate() + 2); // T+2 business days

  return successResponse(res, {
    statusCode: 200,
    message: 'Withdrawal requested successfully',
    data: {
      transactionId: transaction._id,
      amount,
      status: 'PROCESSING',
      estimatedSettlementDate
    }
  });
});
