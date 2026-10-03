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

export const updateRestaurantProfile = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  const { restaurantName, ownerName, cuisines, operatingHours, bannerUrl } = req.body;
  
  // Validation
  if (restaurantName && (restaurantName.length < 3 || restaurantName.length > 100)) {
    return errorResponse(res, { statusCode: 400, message: 'Restaurant name must be between 3 and 100 characters' });
  }
  if (cuisines && (!Array.isArray(cuisines) || cuisines.length < 1 || cuisines.length > 10)) {
    return errorResponse(res, { statusCode: 400, message: 'Cuisines must be an array of 1 to 10 items' });
  }
  
  if (operatingHours) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (operatingHours.open && !timeRegex.test(operatingHours.open)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid open time format (HH:MM)' });
    }
    if (operatingHours.close && !timeRegex.test(operatingHours.close)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid close time format (HH:MM)' });
    }
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    return errorResponse(res, { statusCode: 404, message: 'Restaurant not found' });
  }

  if (restaurantName) restaurant.restaurantName = restaurantName;
  if (ownerName) restaurant.ownerName = ownerName;
  if (cuisines) restaurant.cuisine = cuisines.join(', ');
  if (operatingHours) {
    restaurant.operatingHours = {
      ...restaurant.operatingHours,
      ...operatingHours
    };
  }
  if (bannerUrl !== undefined) {
    if (!restaurant.documents) restaurant.documents = {};
    restaurant.documents.bannerImage = bannerUrl;
  }

  await restaurant.save();

  return successResponse(res, {
    statusCode: 200,
    message: 'Restaurant profile updated successfully'
  });
});

