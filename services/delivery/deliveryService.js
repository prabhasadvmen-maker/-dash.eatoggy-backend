import Delivery from '../../models/delivery/Delivery.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import Order from '../../models/orders/Order.js';
import Restaurant from '../../models/restaurants/Restaurant.js';
import Customer from '../../models/customers/Customer.js';
import { emitToOrderRoom } from '../../realtime/socketServer.js';

/**
 * Helper to generate 4-digit Delivery OTP
 */
const generateDeliveryOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Create a Delivery record when an order is created or reaches READY status
 */
export const createDeliveryForOrder = async (orderId) => {
  let order = await Order.findById(orderId).populate('customerId').populate('restaurantId');
  if (!order) {
    throw { statusCode: 404, message: 'Order not found' };
  }

  let existingDelivery = await Delivery.findOne({ orderId: order._id });
  if (existingDelivery) {
    return existingDelivery;
  }

  const deliveryOtp = generateDeliveryOtp();

  const restaurantSnapshot = {
    name: order.restaurantId?.name || 'Restaurant',
    address: `${order.restaurantId?.address || ''}, ${order.restaurantId?.city || ''}`,
    mobile: order.restaurantId?.ownerMobile || order.restaurantId?.phone || '9876543210',
    latitude: order.restaurantId?.latitude || 28.6139,
    longitude: order.restaurantId?.longitude || 77.2090
  };

  const customerSnapshot = {
    name: order.deliveryAddress?.name || order.customerId?.name || 'Customer',
    mobile: order.deliveryAddress?.mobile || order.customerId?.mobile || '9876543210',
    addressLine1: order.deliveryAddress?.addressLine1 || '',
    addressLine2: order.deliveryAddress?.addressLine2 || '',
    city: order.deliveryAddress?.city || '',
    pincode: order.deliveryAddress?.pincode || '',
    latitude: 28.6139,
    longitude: 77.2090
  };

  const pricingSnapshot = {
    grandTotal: order.pricing?.grandTotal || 0,
    deliveryFee: order.pricing?.deliveryFee || 35
  };

  const delivery = await Delivery.create({
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerId: order.customerId._id || order.customerId,
    restaurantId: order.restaurantId._id || order.restaurantId,
    assignmentStatus: 'PENDING',
    deliveryStatus: 'ASSIGNED',
    deliveryOtp,
    restaurantSnapshot,
    customerSnapshot,
    pricingSnapshot,
    assignedAt: new Date()
  });

  return delivery;
};

/**
 * Get available delivery jobs for approved online delivery partners
 */
export const getAvailableJobs = async (partnerId) => {
  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    throw { statusCode: 404, message: 'Delivery partner not found' };
  }

  const jobs = await Delivery.find({
    assignmentStatus: { $in: ['UNASSIGNED', 'PENDING'] },
    deliveryPartnerId: null
  }).sort({ createdAt: -1 });

  return jobs;
};

/**
 * Toggle Delivery Partner Online Status
 */
export const toggleAvailability = async (partnerId, isOnline) => {
  const partner = await DeliveryPartner.findByIdAndUpdate(
    partnerId,
    { isOnline, isAvailable: isOnline },
    { new: true }
  );

  if (!partner) {
    throw { statusCode: 404, message: 'Delivery partner not found' };
  }

  return partner;
};

/**
 * Get current active job assigned to the partner
 */
export const getActiveJobForPartner = async (partnerId) => {
  const activeJob = await Delivery.findOne({
    deliveryPartnerId: partnerId,
    deliveryStatus: { $ne: 'DELIVERED' },
    assignmentStatus: 'ACCEPTED'
  });

  return activeJob;
};

/**
 * Atomic Accept Delivery Job (Race Condition Protection)
 */
export const acceptDeliveryJob = async (deliveryId, partnerId) => {
  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) {
    throw { statusCode: 404, message: 'Delivery partner not found' };
  }

  if (partner.onboardingStatus !== 'APPROVED') {
    throw { statusCode: 403, message: 'Delivery partner must be approved to accept jobs' };
  }

  // Atomic findOneAndUpdate query ensures only 1 partner can claim the job
  const delivery = await Delivery.findOneAndUpdate(
    {
      _id: deliveryId,
      assignmentStatus: { $in: ['UNASSIGNED', 'PENDING'] },
      deliveryPartnerId: null
    },
    {
      $set: {
        deliveryPartnerId: partnerId,
        assignmentStatus: 'ACCEPTED',
        deliveryStatus: 'ACCEPTED',
        acceptedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!delivery) {
    throw { statusCode: 409, message: 'Job has already been claimed by another delivery partner' };
  }

  await DeliveryPartner.findByIdAndUpdate(partnerId, { isAvailable: false });

  // Emit Real-Time Status Update Event
  emitToOrderRoom(delivery.orderId, 'delivery:status:update', {
    orderId: delivery.orderId,
    deliveryId: delivery._id,
    deliveryStatus: 'ACCEPTED',
    updatedAt: new Date()
  });

  return delivery;
};

/**
 * Update Delivery Status (PICKED_UP / OUT_FOR_DELIVERY)
 */
export const updateDeliveryStatus = async (deliveryId, partnerId, targetStatus) => {
  const delivery = await Delivery.findOne({ _id: deliveryId, deliveryPartnerId: partnerId });
  if (!delivery) {
    throw { statusCode: 404, message: 'Active delivery job not found for this partner' };
  }

  if (delivery.deliveryStatus === 'DELIVERED') {
    throw { statusCode: 400, message: 'Cannot modify status of an already delivered order' };
  }

  const validStatuses = ['PICKED_UP', 'OUT_FOR_DELIVERY'];
  if (!validStatuses.includes(targetStatus)) {
    throw { statusCode: 400, message: `Invalid target delivery status: ${targetStatus}` };
  }

  delivery.deliveryStatus = targetStatus;
  let updatedOrderStatus = undefined;

  if (targetStatus === 'PICKED_UP') {
    delivery.pickedUpAt = new Date();
  } else if (targetStatus === 'OUT_FOR_DELIVERY') {
    delivery.outForDeliveryAt = new Date();
    updatedOrderStatus = 'OUT_FOR_DELIVERY';

    // Sync Order Status to OUT_FOR_DELIVERY
    await Order.findByIdAndUpdate(delivery.orderId, {
      orderStatus: 'OUT_FOR_DELIVERY',
      $push: {
        statusHistory: {
          status: 'OUT_FOR_DELIVERY',
          timestamp: new Date(),
          updatedBy: 'DELIVERY_PARTNER',
          note: 'Order picked up and out for delivery'
        }
      }
    });
  }

  await delivery.save();

  // Emit Real-Time Status Update Event
  emitToOrderRoom(delivery.orderId, 'delivery:status:update', {
    orderId: delivery.orderId,
    deliveryId: delivery._id,
    deliveryStatus: targetStatus,
    orderStatus: updatedOrderStatus,
    updatedAt: new Date()
  });

  return delivery;
};

/**
 * Update Live GPS Location
 */
export const updateDeliveryLocation = async (deliveryId, partnerId, latitude, longitude) => {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    throw { statusCode: 400, message: 'Valid numeric latitude and longitude are required' };
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw { statusCode: 400, message: 'Latitude must be between -90 and 90, and longitude between -180 and 180' };
  }

  const delivery = await Delivery.findOne({ _id: deliveryId, deliveryPartnerId: partnerId });
  if (!delivery) {
    throw { statusCode: 404, message: 'Active delivery job not found for this partner' };
  }

  if (delivery.deliveryStatus === 'DELIVERED') {
    throw { statusCode: 400, message: 'Cannot update location for a completed delivery' };
  }

  const now = new Date();
  delivery.currentLocation = {
    latitude,
    longitude,
    updatedAt: now
  };
  await delivery.save();

  await DeliveryPartner.findByIdAndUpdate(partnerId, {
    currentLocation: { latitude, longitude, updatedAt: now }
  });

  // Emit Real-Time Location Update Event
  emitToOrderRoom(delivery.orderId, 'delivery:location:update', {
    orderId: delivery.orderId,
    deliveryId: delivery._id,
    latitude,
    longitude,
    updatedAt: now
  });

  return delivery;
};

/**
 * Verify Delivery OTP and Complete Delivery
 */
export const verifyOtpAndCompleteDelivery = async (deliveryId, partnerId, otp) => {
  if (!otp) {
    throw { statusCode: 400, message: 'Delivery OTP is required for completion' };
  }

  const delivery = await Delivery.findOne({ _id: deliveryId, deliveryPartnerId: partnerId });
  if (!delivery) {
    throw { statusCode: 404, message: 'Active delivery job not found for this partner' };
  }

  if (delivery.deliveryStatus === 'DELIVERED') {
    throw { statusCode: 400, message: 'Delivery has already been completed' };
  }

  if (delivery.deliveryOtp !== String(otp).trim()) {
    throw { statusCode: 400, message: 'Invalid Delivery OTP. Verification failed.' };
  }

  const now = new Date();
  delivery.deliveryStatus = 'DELIVERED';
  delivery.assignmentStatus = 'COMPLETED';
  delivery.deliveredAt = now;
  await delivery.save();

  // Update linked Order status to DELIVERED
  await Order.findByIdAndUpdate(delivery.orderId, {
    orderStatus: 'DELIVERED',
    $push: {
      statusHistory: {
        status: 'DELIVERED',
        timestamp: now,
        updatedBy: 'DELIVERY_PARTNER',
        note: 'Order successfully delivered to customer'
      }
    }
  });

  // Release Delivery Partner availability
  await DeliveryPartner.findByIdAndUpdate(partnerId, { isAvailable: true });

  // Emit Real-Time Delivery Completed Event
  emitToOrderRoom(delivery.orderId, 'delivery:status:update', {
    orderId: delivery.orderId,
    deliveryId: delivery._id,
    deliveryStatus: 'DELIVERED',
    orderStatus: 'DELIVERED',
    updatedAt: now
  });

  return delivery;
};

/**
 * Get Live Order Tracking for Customer
 */
export const getCustomerOrderTracking = async (customerId, orderId) => {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) {
    throw { statusCode: 404, message: 'Order not found for customer' };
  }

  const delivery = await Delivery.findOne({ orderId: order._id }).populate('deliveryPartnerId', 'fullName mobile vehicleType currentLocation');

  return {
    orderStatus: order.orderStatus,
    deliveryOtp: delivery ? delivery.deliveryOtp : null,
    deliveryStatus: delivery ? delivery.deliveryStatus : 'PENDING_ASSIGNMENT',
    partnerInfo: delivery && delivery.deliveryPartnerId ? {
      fullName: delivery.deliveryPartnerId.fullName || 'EATOGGY Rider',
      mobile: delivery.deliveryPartnerId.mobile || '',
      vehicleType: delivery.deliveryPartnerId.vehicleType || 'Bike'
    } : null,
    currentLocation: delivery ? delivery.currentLocation : { latitude: 28.6139, longitude: 77.2090, updatedAt: new Date() },
    restaurantSnapshot: delivery ? delivery.restaurantSnapshot : null,
    customerSnapshot: delivery ? delivery.customerSnapshot : null
  };
};

