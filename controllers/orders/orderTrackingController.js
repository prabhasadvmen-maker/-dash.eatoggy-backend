import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getOrderTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  return successResponse(res, {
    statusCode: 200,
    message: 'Tracking info retrieved successfully',
    data: { orderId: id, status: 'IN_TRANSIT', location: {}, estimatedTime: '15 mins', deliveryPartner: {} }
  });
});
