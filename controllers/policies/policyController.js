import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getPrivacyPolicy = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Privacy policy retrieved successfully',
    data: { title: 'Privacy Policy', content: '', lastUpdated: new Date() }
  });
});

export const getTermsAndConditions = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Terms and Conditions retrieved successfully',
    data: { title: 'Terms and Conditions', content: '', lastUpdated: new Date() }
  });
});
