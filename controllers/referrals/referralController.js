import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getReferral = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Referral info retrieved successfully',
    data: { referralCode: 'REF123', referralLink: '', earnedAmount: 0, referralCount: 0, rewards: [] }
  });
});
