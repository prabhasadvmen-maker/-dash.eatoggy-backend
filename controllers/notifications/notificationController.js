import { asyncHandler } from '../../common/asyncHandler.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

export const registerFCMToken = asyncHandler(async (req, res) => {
  const customerId = req.customer?.id || req.user?.id;
  if (!customerId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized access' });
  }

  const { fcmToken, deviceType, appVersion } = req.body;
  if (!fcmToken) {
    return errorResponse(res, { statusCode: 400, message: 'FCM Token is required' });
  }

  const Customer = (await import('../../models/customers/Customer.js')).default;
  const customer = await Customer.findById(customerId);
  
  if (!customer) {
    return errorResponse(res, { statusCode: 404, message: 'Customer not found' });
  }

  // Usually you would have a Device model or store it in Customer model
  if (!customer.fcmTokens) {
    customer.fcmTokens = [];
  }
  
  if (!customer.fcmTokens.includes(fcmToken)) {
    customer.fcmTokens.push(fcmToken);
    await customer.save();
  }

  return successResponse(res, {
    message: 'Device token registered successfully'
  });
});

export const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, read } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Notifications retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});

