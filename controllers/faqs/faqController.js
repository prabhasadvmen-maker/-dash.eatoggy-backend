import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getFaqs = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'FAQs retrieved successfully',
    data: []
  });
});
