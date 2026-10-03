import Delivery from '../../models/delivery/Delivery.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import Order from '../../models/orders/Order.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

const getPartnerId = (req) => {
  return req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
};

/**
 * @desc Get Delivery Partner Dashboard Data
 * @route GET /api/delivery/dashboard
 * @access Private (Delivery Partner)
 */
export const getDashboard = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized access' });
    }

    const partner = await DeliveryPartner.findById(partnerId).lean();
    if (!partner) {
      return errorResponse(res, { statusCode: 404, message: 'Partner not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all deliveries for the partner today
    const todaysDeliveries = await Delivery.find({
      deliveryPartnerId: partnerId,
      createdAt: { $gte: today, $lt: tomorrow }
    }).lean();

    // Calculate metrics
    let completedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let totalEarnings = 0;

    const nextDeliveries = [];

    todaysDeliveries.forEach(delivery => {
      // Assuming completed is DELIVERED
      if (delivery.deliveryStatus === 'DELIVERED' || delivery.assignmentStatus === 'COMPLETED') {
        completedCount++;
        totalEarnings += (delivery.pricingSnapshot?.deliveryFee || 0);
      } 
      else if (['REJECTED', 'FAILED', 'EXPIRED'].includes(delivery.assignmentStatus)) {
        rejectedCount++;
      }
      else {
        pendingCount++;
        // Keep active ones for next deliveries
        if (['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(delivery.deliveryStatus)) {
          nextDeliveries.push({
            orderId: delivery.orderNumber || delivery._id,
            status: delivery.deliveryStatus,
            paymentType: 'PREPAID', // Or fetch from order
            pickupAddress: delivery.restaurantSnapshot?.address || '',
            dropAddress: delivery.customerSnapshot?.addressLine1 || ''
          });
        }
      }
    });

    // If no active, maybe add pending assignments
    if (nextDeliveries.length === 0) {
       const pendingAssignments = todaysDeliveries.filter(d => d.assignmentStatus === 'PENDING');
       pendingAssignments.forEach(delivery => {
         nextDeliveries.push({
            orderId: delivery.orderNumber || delivery._id,
            status: 'PICKUP_PENDING',
            paymentType: 'COD',
            pickupAddress: delivery.restaurantSnapshot?.address || '',
            dropAddress: delivery.customerSnapshot?.addressLine1 || ''
         });
       });
    }

    const data = {
      isOnline: partner.isOnline || partner.isActive || false,
      totalEarnings,
      completedDeliveries: completedCount,
      totalTargetDeliveries: 15,
      pendingDeliveries: pendingCount,
      rejectedDeliveries: rejectedCount,
      nextDeliveries: nextDeliveries.slice(0, 3)
    };

    return successResponse(res, { data });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update Delivery Partner Status
 * @route PUT /api/delivery/partner/status
 * @access Private (Delivery Partner)
 */
export const updatePartnerStatus = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized access' });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return errorResponse(res, { statusCode: 400, message: 'isActive must be a boolean' });
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      { isActive, isOnline: isActive }, // Update both to be safe
      { new: true }
    );

    if (!partner) {
      return errorResponse(res, { statusCode: 404, message: 'Partner not found' });
    }

    // Example of emitting websocket event if req.io is configured
    if (req.io) {
      req.io.emit('partner:status_changed', { partnerId, isActive });
    }

    return successResponse(res, {
      message: 'Status updated',
      data: { isActive: partner.isActive }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get Today's Delivery Assignments
 * @route GET /api/delivery/orders/today
 * @access Private (Delivery Partner)
 */
export const getTodaysOrders = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized access' });
    }

    const { status } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = {
      deliveryPartnerId: partnerId,
      createdAt: { $gte: today, $lt: tomorrow }
    };

    if (status) {
      // Map query status to actual model status
      if (status === 'pending') query.deliveryStatus = 'ASSIGNED';
      else if (status === 'readyToPickup') query.deliveryStatus = 'ACCEPTED';
      else if (status === 'outForDelivery') query.deliveryStatus = 'OUT_FOR_DELIVERY';
      else if (status === 'delivered') query.deliveryStatus = 'DELIVERED';
      else query.deliveryStatus = status.toUpperCase();
    }

    const deliveries = await Delivery.find(query).sort({ createdAt: 1 }).lean();

    const assignments = deliveries.map(d => ({
      orderId: d.orderNumber || d._id,
      customerName: d.customerSnapshot?.name || 'Customer',
      address: d.customerSnapshot?.addressLine1 || '',
      timeSlot: 'ASAP', // Since timeSlot isn't in Delivery schema by default
      tiffinsCount: d.pricingSnapshot?.tiffinsCount || 1, // Optional tiffin count
      status: d.deliveryStatus.toLowerCase(),
      statusText: d.deliveryStatus
    }));

    return successResponse(res, { data: { assignments } });
  } catch (error) {
    next(error);
  }
};
