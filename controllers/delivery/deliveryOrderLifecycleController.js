import mongoose from 'mongoose';
import Delivery from '../../models/delivery/Delivery.js';
import Order from '../../models/orders/Order.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { logger } from '../../config/index.js';

const getPartnerId = (req) => {
  const raw = req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
  if (!raw) return null;
  try {
    return new mongoose.Types.ObjectId(raw.toString());
  } catch {
    return null;
  }
};

/**
 * @desc Get Order History
 * @route GET /api/delivery/orders/history
 * @access Private (Delivery Partner)
 */
export const getOrderHistory = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });
    }

    const { filter = 'today', page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    if (filter === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (filter === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (req.query.from && req.query.to) {
      startDate = new Date(req.query.from);
      endDate = new Date(req.query.to);
    }

    const query = {
      deliveryPartnerId: partnerId,
      deliveryStatus: { $in: ['DELIVERED', 'FAILED'] },
      updatedAt: { $gte: startDate, $lt: endDate }
    };

    const total = await Delivery.countDocuments(query);
    const deliveries = await Delivery.find(query)
      .sort({ updatedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const history = deliveries.map(d => ({
      _id: d._id,
      orderNumber: d.orderNumber || d._id,
      customerName: d.customerSnapshot?.name || 'Customer',
      restaurantName: d.restaurantSnapshot?.name || 'Restaurant',
      customerAddress: d.customerSnapshot?.addressLine1 || 'Customer Address',
      timestamp: d.deliveredAt || d.updatedAt,
      status: d.deliveryStatus,
      statusText: d.deliveryStatus,
      deliveryFee: d.pricingSnapshot?.deliveryFee || 0,
      earningsAmount: d.pricingSnapshot?.deliveryFee || 0,
      earningsFormatted: (d.pricingSnapshot?.deliveryFee || 0).toFixed(2)
    }));

    return successResponse(res, {
      data: {
        deliveries: history,
        pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get Full Order Details
 * @route GET /api/delivery/orders/:orderId
 * @access Private (Delivery Partner)
 */
export const getOrderDetails = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });
    }

    const { orderId } = req.params; // Can be mongo id or orderNumber
    
    // Find delivery
    const delivery = await Delivery.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }],
      deliveryPartnerId: partnerId
    }).lean();

    if (!delivery) {
      return errorResponse(res, { statusCode: 404, message: 'Delivery not found or not assigned to you' });
    }

    // Fetch order to get items (optional - if not found, use delivery data)
    const order = await Order.findById(delivery.orderId).lean();
    
    let totalItems = 1;
    let items = [];
    
    if (order && order.items) {
      totalItems = order.items.reduce((acc, item) => acc + item.quantity, 0);
      items = order.items.map(item => ({
        name: item.foodNameSnapshot || 'Item',
        quantity: item.quantity
      }));
    }

    const data = {
      orderId: delivery.orderNumber || delivery._id,
      customerName: delivery.customerSnapshot?.name || 'Customer',
      subscriptionType: 'Eatoggy Customer',
      phoneNumber: delivery.customerSnapshot?.mobile || '',
      deliveryLocation: delivery.customerSnapshot?.addressLine1 || '',
      payloadTitle: `Delivery Order`,
      packagesCount: totalItems,
      timeSlot: delivery.timeSlot || 'ASAP',
      items,
      totalItems,
      deliveryNotes: order?.orderNotes || '',
      isPickupConfirmed: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(delivery.deliveryStatus)
    };

    return successResponse(res, { data });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Confirm Pickup
 * @route POST /api/delivery/orders/:orderId/confirm-pickup
 * @access Private (Delivery Partner)
 */
export const confirmPickup = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { orderId } = req.params;

    const delivery = await Delivery.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }],
      deliveryPartnerId: partnerId
    });

    if (!delivery) {
      return errorResponse(res, { statusCode: 404, message: 'Delivery not found or not assigned to you' });
    }

    if (delivery.deliveryStatus !== 'ACCEPTED') {
      return errorResponse(res, { statusCode: 422, message: `Cannot confirm pickup from status ${delivery.deliveryStatus}` });
    }

    delivery.deliveryStatus = 'PICKED_UP';
    delivery.pickedUpAt = new Date();
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.orderId, {
      status: 'PICKED_UP',
      $push: { statusEvents: { status: 'PICKED_UP', note: 'Picked up by partner' } }
    });

    if (req.io) {
      req.io.emit('order:status_changed', { orderId: delivery.orderId, status: 'PICKED_UP' });
    }

    return successResponse(res, {
      message: 'Pickup confirmed',
      data: {
        orderId: delivery.orderNumber || delivery._id,
        status: 'pickedUp',
        isPickupConfirmed: true
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Verify OTP
 * @route POST /api/delivery/orders/:orderId/verify-otp
 * @access Private (Delivery Partner)
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { orderId } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return errorResponse(res, { statusCode: 400, message: 'OTP is required' });
    }

    const delivery = await Delivery.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }],
      deliveryPartnerId: partnerId
    });

    if (!delivery) {
      return errorResponse(res, { statusCode: 404, message: 'Delivery not found or not assigned to you' });
    }

    if (delivery.deliveryOtp !== otp) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid OTP' });
    }

    delivery.isOtpVerified = true;
    await delivery.save();

    return successResponse(res, {
      message: 'OTP verified',
      data: {
        orderId: delivery.orderNumber || delivery._id,
        isVerified: true,
        status: 'delivered'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Complete Delivery
 * @route POST /api/delivery/orders/:orderId/complete
 * @access Private (Delivery Partner)
 */
export const completeDelivery = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { orderId } = req.params;

    const delivery = await Delivery.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }],
      deliveryPartnerId: partnerId
    });

    if (!delivery) {
      return errorResponse(res, { statusCode: 404, message: 'Delivery not found or not assigned to you' });
    }

    if (delivery.deliveryStatus === 'DELIVERED') {
      return errorResponse(res, { statusCode: 422, message: 'Delivery is already completed' });
    }

    if (!delivery.isOtpVerified) {
      return errorResponse(res, { statusCode: 403, message: 'OTP verification required before completing delivery' });
    }

    const timestamp = new Date();
    delivery.deliveryStatus = 'DELIVERED';
    delivery.assignmentStatus = 'COMPLETED';
    delivery.deliveredAt = timestamp;
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.orderId, {
      orderStatus: 'DELIVERED',
      $push: { statusHistory: { status: 'DELIVERED', timestamp, updatedBy: 'DELIVERY_PARTNER', note: 'Delivered to customer' } }
    });

    const earnings = delivery.pricingSnapshot?.deliveryFee || 0;
    try {
      await DeliveryPartner.findByIdAndUpdate(partnerId, {
        $inc: { walletBalance: earnings, totalEarnings: earnings, totalDeliveries: 1 }
      });
    } catch (walletError) {
      logger.error(`Wallet update failed for partner ${partnerId}:`, walletError.message);
    }

    if (req.io) {
      req.io.emit('order:status_changed', { orderId: delivery.orderId, status: 'DELIVERED' });
      req.io.to(partnerId.toString()).emit('partner:payout', { amount: earnings });
    }

    return successResponse(res, {
      data: {
        orderId: delivery.orderNumber || delivery._id,
        timestamp: timestamp.toLocaleString(),
        customerName: delivery.customerSnapshot?.name || 'Customer',
        earningsCredited: earnings,
        earningsCreditedFormatted: earnings.toFixed(2),
        status: 'delivered'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Accept Order Assignment
 * @route POST /api/delivery/orders/:orderId/accept
 * @access Private (Delivery Partner)
 */
export const acceptOrder = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { orderId } = req.params;
    const { latitude, longitude } = req.body;

    const delivery = await Delivery.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }],
      deliveryPartnerId: partnerId
    });

    if (!delivery) {
      return errorResponse(res, { statusCode: 404, message: 'Delivery not found or not assigned to you' });
    }

    if (['ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(delivery.deliveryStatus)) {
      return errorResponse(res, { statusCode: 422, message: `Order already in ${delivery.deliveryStatus} state` });
    }

    delivery.assignmentStatus = 'ACCEPTED';
    delivery.deliveryStatus = 'ACCEPTED';
    delivery.acceptedAt = new Date();
    if (latitude && longitude) {
      delivery.partnerLocation = { latitude, longitude, updatedAt: new Date() };
    }
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.orderId, {
      orderStatus: 'ACCEPTED',
      $push: { statusHistory: { status: 'ACCEPTED', timestamp: new Date(), updatedBy: 'DELIVERY_PARTNER', note: 'Accepted by delivery partner' } }
    });

    if (req.io) {
      req.io.emit('order:status_changed', { orderId: delivery.orderId, status: 'ACCEPTED' });
    }

    return successResponse(res, {
      message: 'Order accepted successfully',
      data: { orderId: delivery.orderNumber || delivery._id, status: 'ACCEPTED' }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Reject / Decline Order Assignment
 * @route POST /api/delivery/orders/:orderId/reject
 * @access Private (Delivery Partner)
 */
export const rejectOrder = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { orderId } = req.params;
    const { reason, notes, latitude, longitude } = req.body;

    const delivery = await Delivery.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }],
      deliveryPartnerId: partnerId
    });

    if (!delivery) {
      return errorResponse(res, { statusCode: 404, message: 'Delivery not found or not assigned to you' });
    }

    delivery.assignmentStatus = 'REJECTED';
    delivery.deliveryPartnerId = null;
    if (latitude && longitude) {
      delivery.partnerLocation = { latitude, longitude, updatedAt: new Date() };
    }
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.orderId, {
      $push: { statusHistory: { status: 'ACCEPTED', timestamp: new Date(), updatedBy: 'DELIVERY_PARTNER', note: `Rejected by partner: ${reason || 'No reason'} - ${notes || ''}` } }
    });

    if (req.io) {
      req.io.emit('order:reassign_needed', { orderId: delivery.orderId, reason });
    }

    return successResponse(res, { message: 'Order declined. Order will be reassigned.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Report Issue
 * @route POST /api/delivery/orders/:orderId/report-issue
 * @access Private (Delivery Partner)
 */
export const reportIssue = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { orderId } = req.params;
    const { selectedReason, additionalNotes } = req.body;

    if (!selectedReason) {
      return errorResponse(res, { statusCode: 400, message: 'selectedReason is required' });
    }

    const delivery = await Delivery.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }],
      deliveryPartnerId: partnerId
    });

    if (!delivery) {
      return errorResponse(res, { statusCode: 404, message: 'Delivery not found or not assigned to you' });
    }

    delivery.assignmentStatus = 'REJECTED';
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.orderId, {
      orderStatus: 'CANCELLED',
      $push: { statusHistory: { status: 'CANCELLED', timestamp: new Date(), updatedBy: 'DELIVERY_PARTNER', note: `Delivery Failed: ${selectedReason} - ${additionalNotes || ''}` } }
    });

    return successResponse(res, {
      message: 'Issue reported successfully',
      data: {
        issueId: `ISS-${Date.now().toString().slice(-6)}`,
        orderId: delivery.orderNumber || delivery._id,
        status: 'failed'
      }
    });
  } catch (error) {
    next(error);
  }
};
