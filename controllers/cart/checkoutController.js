import * as checkoutService from '../../services/cart/checkoutService.js';
import crypto from 'crypto';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import CheckoutSession from '../../models/cart/CheckoutSession.js';
import Cart from '../../models/cart/Cart.js';
import Order from '../../models/orders/Order.js';
import Payment from '../../models/payments/Payment.js';

const getCustomerId = (req) => {
  return req.customer?.id || req.customer?._id || req.user?.id || req.user?._id;
};

/**
 * @desc    Get server-calculated checkout summary & bill breakdown
 * @route   GET /api/checkout/summary
 * @access  Private (Customer)
 */
export const getCheckoutSummary = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized customer access' });
    }

    const { addressId } = req.query;
    const summary = await checkoutService.getCheckoutSummary(customerId, addressId || null);

    res.status(200).json({
      success: true,
      message: 'Checkout summary calculated successfully',
      data: summary
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Initiate checkout session with server-calculated price breakdown
 * @route   POST /api/checkout/initiate
 * @access  Private (Customer)
 */
export const initiateCheckout = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized customer access' });
    }

    const { addressId } = req.body;
    const session = await checkoutService.initiateCheckout(customerId, { addressId });

    res.status(200).json({
      success: true,
      message: 'Checkout session initiated successfully',
      data: session
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc    Verify Payment & Place Order
 * @route   POST /api/checkout/verify-payment
 * @access  Private (Customer)
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized customer access' });
    }

    const { checkoutSessionId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!checkoutSessionId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return errorResponse(res, { statusCode: 400, message: 'Missing payment verification details' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return errorResponse(res, { statusCode: 500, message: 'Razorpay secret not configured' });
    }

    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid payment signature' });
    }

    // Verify session and place order using mongoose models
    const session = await CheckoutSession.findById(checkoutSessionId);
    if (!session) {
      return errorResponse(res, { statusCode: 404, message: 'Checkout session not found' });
    }

    if (session.customerId.toString() !== customerId.toString()) {
      return errorResponse(res, { statusCode: 403, message: 'Session does not belong to customer' });
    }

    const cart = await Cart.findOne({ customerId }).populate('items.menuItemId');
    if (!cart || cart.items.length === 0) {
      return errorResponse(res, { statusCode: 400, message: 'Cart is empty' });
    }

    // Prepare order data
    const orderItems = cart.items.map(item => ({
      menuItemId: item.menuItemId._id,
      foodNameSnapshot: item.menuItemId.name,
      foodImageSnapshot: item.menuItemId.image,
      unitPrice: item.menuItemId.price,
      quantity: item.quantity,
      itemTotal: item.menuItemId.price * item.quantity,
      foodType: item.menuItemId.foodType
    }));

    let order;
    try {
      const orderNumber = 'ORD-' + Date.now().toString().slice(-6);
      
      order = new Order({
        orderNumber,
        customerId,
        restaurantId: cart.restaurantId,
        items: orderItems,
        deliveryAddress: session.deliveryAddress,
        pricing: session.pricing,
        orderStatus: 'PLACED',
        paymentStatus: 'PAID',
        statusHistory: [{ status: 'PLACED', updatedBy: 'SYSTEM', note: 'Order placed via Razorpay' }]
      });

      const payment = new Payment({
        customer: customerId,
        restaurant: cart.restaurantId,
        checkoutSession: checkoutSessionId,
        purpose: 'ORDER_PAYMENT',
        amount: session.pricing.grandTotal,
        amountPaise: Math.round(session.pricing.grandTotal * 100),
        currency: 'INR',
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
        signatureVerified: true,
        status: 'PAID'
      });

      await payment.save();
      order.paymentId = payment._id;
      await order.save();

      // Clear cart
      cart.items = [];
      cart.restaurantId = null;
      cart.couponCode = null;
      cart.discount = 0;
      cart.pricing = { subtotal: 0, packagingCharge: 0, platformFee: 0, deliveryFee: 0, gst: 0, grandTotal: 0 };
      await cart.save();
      
      // Notify kitchen
      const io = req.app.get('io');
      if (io) {
        io.to(`kitchen_${order.restaurantId.toString()}`).emit('newOrder', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          items: order.items
        });
      }

    } catch (e) {
      return errorResponse(res, { statusCode: 500, message: 'Failed to create order: ' + e.message });
    }

    return successResponse(res, {
      message: 'Payment verified and order placed successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.orderStatus,
        totalAmount: order.pricing.grandTotal,
        placedAt: order.createdAt,
        estimatedDeliveryMinutes: 35,
        estimatedDeliveryTime: new Date(Date.now() + 35*60000).toLocaleTimeString(),
        paymentId: razorpayPaymentId
      }
    });

  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};
