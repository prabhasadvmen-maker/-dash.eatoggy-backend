import { asyncHandler } from '../../common/asyncHandler.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import subscriptionService from '../../services/subscriptions/subscriptionService.js';

/**
 * @desc    Get Authenticated Restaurant's Tiffin Plans
 * @route   GET /api/restaurants/tiffin-plans
 * @access  Protected (Restaurant JWT)
 */
export const getRestaurantPlans = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  const plans = await subscriptionService.getTiffinPlansByRestaurant(restaurantId);
  return successResponse(res, {
    message: 'Restaurant tiffin plans retrieved',
    data: { plans }
  });
});

/**
 * @desc    Create New Tiffin Plan for Restaurant
 * @route   POST /api/restaurants/tiffin-plans
 * @access  Protected (Restaurant JWT)
 */
export const createPlan = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  const plan = await subscriptionService.createTiffinPlan(restaurantId, req.body);
  return successResponse(res, {
    statusCode: 201,
    message: 'Tiffin plan created successfully',
    data: { plan }
  });
});

/**
 * @desc    Update Existing Tiffin Plan
 * @route   PATCH /api/restaurants/tiffin-plans/:id
 * @access  Protected (Restaurant JWT)
 */
export const updatePlan = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  const plan = await subscriptionService.updateTiffinPlan(restaurantId, req.params.id, req.body);
  return successResponse(res, {
    message: 'Tiffin plan updated successfully',
    data: { plan }
  });
});

/**
 * @desc    Toggle Tiffin Plan Availability Status (ACTIVE / INACTIVE)
 * @route   PATCH /api/restaurants/tiffin-plans/:id/status
 * @access  Protected (Restaurant JWT)
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  const { status } = req.body;

  if (!status) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'status is required (ACTIVE or INACTIVE)'
    });
  }

  const plan = await subscriptionService.toggleTiffinPlanStatus(restaurantId, req.params.id, status);
  return successResponse(res, {
    message: 'Tiffin plan status updated successfully',
    data: { plan }
  });
});

export const deletePlan = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  await subscriptionService.deleteTiffinPlan(restaurantId, req.params.id);
  return successResponse(res, {
    message: 'Tiffin plan deleted successfully'
  });
});

export const getTodaysTiffinDeliveries = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });
  }

  const SubscriptionOccurrence = (await import('../../models/subscriptions/SubscriptionOccurrence.js')).default;
  const Subscription = (await import('../../models/subscriptions/Subscription.js')).default;

  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  // Find occurrences for today
  const occurrences = await SubscriptionOccurrence.find({
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['SCHEDULED', 'PROCESSING', 'ORDER_CREATED'] }
  }).populate({
    path: 'subscriptionId',
    match: { restaurantId }, // Only this restaurant's subscriptions
    populate: [
      { path: 'customerId', select: 'fullName mobile' },
      { path: 'tiffinPlanId', select: 'planName mealType' }
    ]
  });

  const deliveries = occurrences
    .filter(occ => occ.subscriptionId !== null)
    .map(occ => {
      const sub = occ.subscriptionId;
      return {
        subscriptionId: sub._id,
        customerName: sub.customerId?.fullName || 'Unknown',
        planName: sub.tiffinPlanId?.planName || 'Plan',
        mealType: sub.tiffinPlanId?.mealType || 'LUNCH',
        address: sub.deliveryAddress ? `${sub.deliveryAddress.addressLine1}, ${sub.deliveryAddress.city}` : 'No Address',
        dispatchTime: sub.deliveryTime,
        status: occ.status
      };
    })
    .sort((a, b) => (a.dispatchTime || '').localeCompare(b.dispatchTime || ''));

  const lunchDeliveries = deliveries.filter(d => d.mealType === 'LUNCH');
  const dinnerDeliveries = deliveries.filter(d => d.mealType === 'DINNER');

  return successResponse(res, {
    statusCode: 200,
    message: "Today's deliveries fetched successfully",
    data: { 
      lunchCount: lunchDeliveries.length, 
      dinnerCount: dinnerDeliveries.length, 
      deliveries: {
        LUNCH: lunchDeliveries,
        DINNER: dinnerDeliveries
      }
    }
  });
});

export const editPlan = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  const { pricePerMeal, isActive, description } = req.body;
  const planId = req.params.planId || req.params.id;

  const TiffinPlan = (await import('../../models/subscriptions/TiffinPlan.js')).default;
  const plan = await TiffinPlan.findOne({ _id: planId, restaurantId });

  if (!plan) {
    return errorResponse(res, { statusCode: 404, message: 'Plan not found' });
  }

  const oldPrice = plan.pricePerMeal;

  if (pricePerMeal !== undefined) plan.pricePerMeal = pricePerMeal;
  if (description !== undefined) plan.description = description;
  
  if (isActive === false) {
    plan.isActive = false; // Mark as paused
  } else if (isActive === true) {
    plan.isActive = true;
  }

  await plan.save();

  if (pricePerMeal !== undefined && pricePerMeal !== oldPrice) {
    // Notify subscribers
    // Notification logic would go here
    console.log(`Notifying subscribers of plan ${planId} about price change`);
  }

  return successResponse(res, {
    statusCode: 200,
    message: 'Tiffin plan updated successfully',
    data: { plan }
  });
});

export default {
  getRestaurantPlans,
  createPlan,
  updatePlan,
  updateStatus,
  deletePlan,
  getTodaysTiffinDeliveries,
  editPlan
};
