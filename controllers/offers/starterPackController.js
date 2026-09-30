import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getStarterPack = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Starter pack retrieved successfully',
    data: { offers: [], totalDiscount: 0, validity: 30 }
  });
});
