import * as orderService from '../../services/orders/orderService.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

const getRestaurantId = (req) => {
  return req.restaurant?.id || req.restaurant?._id || req.user?.restaurantId || req.user?.id || req.user?._id;
};

/**
 * @desc    Get Restaurant Orders List
 * @route   GET /api/restaurant-admin/orders
 * @access  Private (Restaurant Partner)
 */
export const getRestaurantOrders = async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
    }

    const { status } = req.query;
    const orders = await orderService.getRestaurantOrders(restaurantId, status || null);

    return successResponse(res, {
      statusCode: 200,
      message: 'Restaurant orders retrieved successfully',
      data: orders
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Get Single Restaurant Order Details
 * @route   GET /api/restaurant-admin/orders/:id
 * @access  Private (Restaurant Partner)
 */
export const getRestaurantOrderById = async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
    }

    const { id } = req.params;
    const order = await orderService.getRestaurantOrderById(restaurantId, id);

    return successResponse(res, {
      statusCode: 200,
      message: 'Restaurant order details retrieved successfully',
      data: order
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

import { processRefund } from '../../services/payments/paymentService.js';

/**
 * @desc    Accept Order
 * @route   POST /api/restaurants/orders/:orderId/accept
 * @access  Private (Restaurant Partner)
 */
export const acceptOrder = async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
    }

    const { orderId } = req.params;
    const { estimatedPrepTime } = req.body;

    const updatedOrder = await orderService.updateRestaurantOrderStatus(restaurantId, orderId, 'ACCEPTED', '', `Estimated prep time: ${estimatedPrepTime} mins`);
    
    // In a real app, send a notification to the customer here
    // notificationService.sendNotification(updatedOrder.customerId, 'Order Accepted', ...);

    return successResponse(res, {
      statusCode: 200,
      message: 'Order accepted successfully',
      data: {
        orderId: updatedOrder._id,
        orderStatus: updatedOrder.orderStatus,
        acceptedAt: updatedOrder.acceptedAt,
        estimatedPrepTime: estimatedPrepTime || 0
      }
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Reject Order
 * @route   POST /api/restaurants/orders/:orderId/reject
 * @access  Private (Restaurant Partner)
 */
export const rejectOrder = async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
    }

    const { orderId } = req.params;
    const { reasonCode, reasonNote } = req.body;
    const reason = reasonNote || reasonCode;

    if (!reason) {
      return errorResponse(res, { statusCode: 400, message: 'Rejection reason is required' });
    }

    const updatedOrder = await orderService.updateRestaurantOrderStatus(restaurantId, orderId, 'CANCELLED', reason, '');

    let refundStatus = 'NOT_APPLICABLE';
    let refundAmount = 0;

    if (updatedOrder.paymentStatus === 'PAID') {
      refundAmount = updatedOrder.pricing?.grandTotal || 0;
      const refundResult = await processRefund(orderId, refundAmount, reason);
      refundStatus = refundResult.refundStatus;
    }

    return successResponse(res, {
      statusCode: 200,
      message: 'Order rejected and refund initiated',
      data: {
        orderId: updatedOrder._id,
        orderStatus: updatedOrder.orderStatus,
        rejectionReason: updatedOrder.rejectionReason,
        refundStatus,
        refundAmount
      }
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Update Order Status with State Machine Validation
 * @route   PATCH /api/restaurant-admin/orders/:id/status
 * @access  Private (Restaurant Partner)
 */
export const updateRestaurantOrderStatus = async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
    }

    const { id } = req.params;
    const { status, reason, notes } = req.body;

    if (!status) {
      return errorResponse(res, { statusCode: 400, message: 'Target status is required' });
    }

    const updatedOrder = await orderService.updateRestaurantOrderStatus(restaurantId, id, status, reason || '', notes || '');

    return successResponse(res, {
      statusCode: 200,
      message: `Order status updated to ${status} successfully`,
      data: updatedOrder
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Get Restaurant Kitchen Queue Orders
 * @route   GET /api/restaurants/kitchen/orders
 * @access  Private (Restaurant Partner)
 */
export const getKitchenOrders = async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
    }

    const { status } = req.query;
    const orders = await orderService.getKitchenOrders(restaurantId, status || null);

    return successResponse(res, {
      statusCode: 200,
      message: 'Kitchen queue retrieved successfully',
      data: orders
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Update Kitchen Order Status (KDS Endpoint)
 * @route   PATCH /api/restaurants/kitchen/orders/:id/status
 * @access  Private (Restaurant Partner)
 */
export const updateKitchenOrderStatus = async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
    }

    const { id } = req.params;
    const { status, reason, notes } = req.body;

    if (!status) {
      return errorResponse(res, { statusCode: 400, message: 'Target status is required' });
    }

    const updatedOrder = await orderService.updateRestaurantOrderStatus(restaurantId, id, status, reason || '', notes || '');

    return successResponse(res, {
      statusCode: 200,
      message: `Kitchen order status updated to ${status} successfully`,
      data: updatedOrder
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};
