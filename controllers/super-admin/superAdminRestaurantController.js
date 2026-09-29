import Restaurant from '../../models/restaurants/Restaurant.js';
import AuditLog from '../../models/super-admin/AuditLog.js';
import OnboardingFee from '../../models/super-admin/OnboardingFee.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getAllRestaurants = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, restaurantName, mobile, city, status, onboardingStatus, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { restaurantName: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } },
      { ownerName: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } }
    ];
  }
  if (restaurantName) query.restaurantName = { $regex: restaurantName, $options: 'i' };
  if (mobile) query.mobile = { $regex: mobile, $options: 'i' };
  if (city) query.city = { $regex: city, $options: 'i' };
  if (status) query.status = status;
  if (onboardingStatus) query.onboardingStatus = onboardingStatus;

  const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [restaurants, total, statusCounts] = await Promise.all([
    Restaurant.find(query).sort(sortObj).skip((page - 1) * limit).limit(Number(limit)),
    Restaurant.countDocuments(query),
    Restaurant.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const counts = { ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0, SUSPENDED: 0 };
  statusCounts.forEach(({ _id, count }) => {
    if (_id && counts[_id] !== undefined) counts[_id] = count;
    counts.ALL += count;
  });

  return successResponse(res, {
    message: 'Restaurants retrieved successfully',
    data: restaurants,
    meta: {
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      },
      statusCounts: counts
    }
  });
});

export const getRestaurantById = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) {
    return errorResponse(res, { statusCode: 404, message: 'Restaurant not found' });
  }

  return successResponse(res, {
    message: 'Restaurant details retrieved successfully',
    data: { restaurant }
  });
});

export const approveRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) {
    return errorResponse(res, { statusCode: 404, message: 'Restaurant not found' });
  }

  restaurant.status = 'APPROVED';
  restaurant.onboardingStatus = 'APPROVED';
  await restaurant.save();

  await AuditLog.create({
    action: 'RESTAURANT_APPROVED',
    performedBy: req.admin?.id,
    targetId: restaurant._id,
    targetModel: 'Restaurant',
    details: { restaurantName: restaurant.restaurantName, mobile: restaurant.mobile }
  });

  return successResponse(res, {
    message: 'Restaurant approved successfully',
    data: { restaurant }
  });
});

export const rejectRestaurant = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    return errorResponse(res, { statusCode: 400, message: 'Rejection reason is required' });
  }

  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) {
    return errorResponse(res, { statusCode: 404, message: 'Restaurant not found' });
  }

  restaurant.status = 'REJECTED';
  restaurant.rejectionReason = reason;
  restaurant.onboardingStatus = 'REJECTED';
  await restaurant.save();

  await AuditLog.create({
    action: 'RESTAURANT_REJECTED',
    performedBy: req.admin?.id,
    targetId: restaurant._id,
    targetModel: 'Restaurant',
    details: { restaurantName: restaurant.restaurantName, reason }
  });

  return successResponse(res, {
    message: 'Restaurant rejected successfully',
    data: { restaurant }
  });
});

export const suspendRestaurant = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    return errorResponse(res, { statusCode: 400, message: 'Suspension reason is required' });
  }

  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) {
    return errorResponse(res, { statusCode: 404, message: 'Restaurant not found' });
  }

  restaurant.status = 'SUSPENDED';
  restaurant.suspensionReason = reason;
  restaurant.onboardingStatus = 'SUSPENDED';
  await restaurant.save();

  await AuditLog.create({
    action: 'RESTAURANT_SUSPENDED',
    performedBy: req.admin?.id,
    targetId: restaurant._id,
    targetModel: 'Restaurant',
    details: { restaurantName: restaurant.restaurantName, reason }
  });

  return successResponse(res, {
    message: 'Restaurant suspended successfully',
    data: { restaurant }
  });
});

export const unsuspendRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) {
    return errorResponse(res, { statusCode: 404, message: 'Restaurant not found' });
  }

  restaurant.status = 'APPROVED';
  restaurant.suspensionReason = undefined;
  restaurant.onboardingStatus = 'APPROVED';
  await restaurant.save();

  await AuditLog.create({
    action: 'RESTAURANT_UNSUSPENDED',
    performedBy: req.admin?.id,
    targetId: restaurant._id,
    targetModel: 'Restaurant',
    details: { restaurantName: restaurant.restaurantName, mobile: restaurant.mobile }
  });

  return successResponse(res, {
    message: 'Restaurant unsuspended successfully',
    data: { restaurant }
  });
});

export const getFeeSetting = asyncHandler(async (req, res) => {
  let fee = await OnboardingFee.findOne({ key: 'RESTAURANT_ONBOARDING_FEE' });
  if (!fee) {
    fee = await OnboardingFee.create({
      key: 'RESTAURANT_ONBOARDING_FEE',
      amount: 999,
      currency: 'INR'
    });
  }
  return successResponse(res, {
    message: 'Fee setting retrieved successfully',
    data: { fee }
  });
});

export const updateFeeSetting = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (amount === undefined) {
    return errorResponse(res, { statusCode: 400, message: 'Amount is required' });
  }

  let fee = await OnboardingFee.findOne({ key: 'RESTAURANT_ONBOARDING_FEE' });
  if (!fee) {
    fee = await OnboardingFee.create({
      key: 'RESTAURANT_ONBOARDING_FEE',
      amount: Number(amount),
      currency: 'INR',
      updatedBy: req.admin?.id
    });
  } else {
    fee.amount = Number(amount);
    fee.updatedBy = req.admin?.id;
    await fee.save();
  }

  return successResponse(res, {
    message: 'Fee setting updated successfully',
    data: { fee }
  });
});
