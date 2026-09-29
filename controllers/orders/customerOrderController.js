import * as orderService from '../../services/orders/orderService.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

const getCustomerId = (req) => {
  return req.customer?.id || req.customer?._id || req.user?.id || req.user?._id;
};

/**
 * @desc    Get Customer Orders History
 * @route   GET /api/customers/orders
 * @access  Private (Customer)
 */
export const getCustomerOrders = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized customer access' });
    }

    const orders = await orderService.getCustomerOrders(customerId);

    return successResponse(res, {
      statusCode: 200,
      message: 'Customer orders retrieved successfully',
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
 * @desc    Get Single Customer Order Details
 * @route   GET /api/customers/orders/:id
 * @access  Private (Customer)
 */
export const getCustomerOrderById = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized customer access' });
    }

    const { id } = req.params;
    const order = await orderService.getCustomerOrderById(customerId, id);

    return successResponse(res, {
      statusCode: 200,
      message: 'Order details retrieved successfully',
      data: order
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Cancel Active Order
 * @route   POST /api/customers/orders/:orderId/cancel
 * @access  Private (Customer)
 */
export const cancelOrder = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });
    }

    const { orderId } = req.params;
    const { reason } = req.body;

    const Order = (await import('../../models/orders/Order.js')).default;
    const Payment = (await import('../../models/payments/Payment.js')).default;
    const Refund = (await import('../../models/refunds/Refund.js')).default;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return errorResponse(res, { statusCode: 404, message: 'Order not found' });
    }

    if (!order.customerId.equals(customerId)) {
      return errorResponse(res, { statusCode: 403, message: 'Not authorized to cancel this order' });
    }

    if (!['PLACED', 'ACCEPTED'].includes(order.orderStatus)) {
      return errorResponse(res, { statusCode: 400, message: 'Order cannot be cancelled at this stage' });
    }

    // Check time condition (within 60 seconds) or kitchen hasn't started
    const orderTime = new Date(order.createdAt).getTime();
    const now = Date.now();
    const diffSeconds = (now - orderTime) / 1000;

    if (order.orderStatus === 'ACCEPTED' && diffSeconds > 60) {
      return errorResponse(res, { statusCode: 400, message: 'Order cancellation window has expired' });
    }

    order.orderStatus = 'CANCELLED';
    order.statusHistory.push({
      status: 'CANCELLED',
      updatedBy: 'CUSTOMER',
      note: reason || 'Cancelled by customer'
    });
    
    await order.save();

    let refundStatus = 'NOT_APPLICABLE';
    let refundAmount = 0;
    
    // If order was paid, initiate refund
    if (order.paymentStatus === 'PAID') {
      const payment = await Payment.findById(order.paymentId);
      if (payment) {
        payment.status = 'REFUND_INITIATED';
        await payment.save();
        refundStatus = 'INITIATED';
        refundAmount = order.pricing.grandTotal;
        
        const refund = new Refund({
          orderId: order._id,
          customerId,
          paymentId: order.paymentId,
          amount: order.pricing.grandTotal,
          reason: reason || 'Cancelled by customer',
          status: 'INITIATED',
          initiatedAt: new Date()
        });
        await refund.save();
      }
    }

    return successResponse(res, {
      message: 'Order cancelled successfully',
      data: {
        orderId: order.orderNumber,
        status: 'CANCELLED',
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
