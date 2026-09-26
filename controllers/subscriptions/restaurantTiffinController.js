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

export default {
  getRestaurantPlans,
  createPlan,
  updatePlan,
  updateStatus,
  deletePlan
};
