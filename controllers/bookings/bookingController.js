import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getMyBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Bookings retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});
