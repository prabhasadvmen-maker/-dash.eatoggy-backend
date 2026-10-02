import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import Restaurant from '../../models/restaurants/Restaurant.js';

export const getRestaurantProfile = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) {
    return errorResponse(res, { statusCode: 404, message: 'Restaurant profile not found' });
  }

  let maskedAccountNumber = '';
  if (restaurant.bankDetails?.accountNumber) {
    const accNum = restaurant.bankDetails.accountNumber;
    maskedAccountNumber = accNum.length > 4 
      ? `****${accNum.substring(accNum.length - 4)}` 
      : accNum;
  }

  const data = {
    restaurantId: restaurant._id,
    restaurantName: restaurant.restaurantName,
    ownerName: restaurant.ownerName,
    email: restaurant.email,
    mobile: restaurant.mobile,
    restaurantType: restaurant.restaurantType,
    cuisines: restaurant.cuisine ? restaurant.cuisine.split(',').map(c => c.trim()) : [],
    fullAddress: restaurant.fullAddress,
    city: restaurant.city,
    pincode: restaurant.pincode,
    operatingHours: restaurant.operatingHours,
    breakSlot: restaurant.breakSlot || null,
    bankDetails: restaurant.bankDetails ? {
      accountHolderName: restaurant.bankDetails.accountHolderName,
      accountNumber: maskedAccountNumber,
      ifscCode: restaurant.bankDetails.ifscCode,
      upiId: restaurant.bankDetails.upiId
    } : null,
    logoUrl: restaurant.documents?.restaurantImage || null,
    bannerUrl: restaurant.documents?.bannerImage || null,
    status: restaurant.status,
    onboardingStatus: restaurant.onboardingStatus,
    isOnline: restaurant.isOnline !== undefined ? restaurant.isOnline : true,
    createdAt: restaurant.createdAt
  };

  return successResponse(res, {
    statusCode: 200,
    message: 'Restaurant profile retrieved successfully',
    data
  });
});
