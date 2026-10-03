import { getIO } from './socketServer.js';
import { logger } from '../config/index.js';
import Delivery from '../models/delivery/Delivery.js';
import DeliveryPartner from '../models/delivery/DeliveryPartner.js';

/**
 * Event 1: order:assigned
 * Emitted when a new delivery order is assigned to a delivery partner
 * Server → Client (Delivery Partner)
 */
export const emitOrderAssigned = (partnerId, deliveryData) => {
  const io = getIO();
  if (!io) {
    logger.warn('Socket.IO not initialized for order:assigned event');
    return false;
  }

  const payload = {
    orderId: deliveryData.orderId,
    orderNumber: deliveryData.orderNumber,
    deliveryId: deliveryData._id,
    customerName: deliveryData.customerSnapshot?.name,
    customerPhone: deliveryData.customerSnapshot?.mobile,
    deliveryAddress: deliveryData.customerSnapshot?.addressLine1,
    restaurantName: deliveryData.restaurantSnapshot?.name,
    restaurantAddress: deliveryData.restaurantSnapshot?.address,
    deliveryFee: deliveryData.pricingSnapshot?.deliveryFee,
    estimatedPickupTime: '5-10 mins',
    timestamp: new Date()
  };

  io.to(`partner:${partnerId}`).emit('order:assigned', payload);
  logger.info(`Event emitted: order:assigned to partner ${partnerId}`);
  return true;
};

/**
 * Event 2: order:status_changed
 * Emitted when delivery status changes (ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED)
 * Server → Client (All stakeholders: Customer, Restaurant, Delivery Partner)
 */
export const emitOrderStatusChanged = (orderId, deliveryId, newStatus, partnerId = null) => {
  const io = getIO();
  if (!io) {
    logger.warn('Socket.IO not initialized for order:status_changed event');
    return false;
  }

  const payload = {
    orderId,
    deliveryId,
    status: newStatus,
    timestamp: new Date(),
    statusMap: {
      ACCEPTED: 'Partner accepted the order',
      PICKED_UP: 'Order picked up from restaurant',
      OUT_FOR_DELIVERY: 'Order is on the way',
      DELIVERED: 'Order delivered successfully'
    }
  };

  // Emit to order room (all stakeholders)
  io.to(`order:${orderId}`).emit('order:status_changed', payload);
  
  // Also emit to partner's personal room
  if (partnerId) {
    io.to(`partner:${partnerId}`).emit('order:status_changed', payload);
  }

  logger.info(`Event emitted: order:status_changed for order ${orderId} - status: ${newStatus}`);
  return true;
};

/**
 * Event 3: partner:location_update
 * Emitted when delivery partner updates their GPS location
 * Client → Server (Delivery Partner sends) → Server → Client (Customer receives)
 */
export const emitPartnerLocationUpdate = (orderId, partnerId, latitude, longitude) => {
  const io = getIO();
  if (!io) {
    logger.warn('Socket.IO not initialized for partner:location_update event');
    return false;
  }

  const payload = {
    orderId,
    partnerId,
    latitude,
    longitude,
    timestamp: new Date()
  };

  // Emit to order room so customer can see live location
  io.to(`order:${orderId}`).emit('partner:location_update', payload);
  
  logger.info(`Event emitted: partner:location_update for order ${orderId} at (${latitude}, ${longitude})`);
  return true;
};

/**
 * Event 4: partner:onboarding_status
 * Emitted when delivery partner's onboarding status changes
 * Server → Client (Delivery Partner)
 */
export const emitPartnerOnboardingStatus = (partnerId, onboardingStatus, details = {}) => {
  const io = getIO();
  if (!io) {
    logger.warn('Socket.IO not initialized for partner:onboarding_status event');
    return false;
  }

  const statusMessages = {
    DRAFT: 'Profile setup started',
    OTP_VERIFIED: 'Mobile number verified',
    ONBOARDING_IN_PROGRESS: 'Documents under review',
    PENDING_PAYMENT: 'Awaiting onboarding fee payment',
    PAYMENT_SUCCESS: 'Payment received successfully',
    PENDING_REVIEW: 'Application under review',
    APPROVED: 'Congratulations! You are approved',
    REJECTED: 'Application rejected',
    SUSPENDED: 'Account suspended'
  };

  const payload = {
    partnerId,
    status: onboardingStatus,
    message: statusMessages[onboardingStatus] || 'Status updated',
    details,
    timestamp: new Date()
  };

  io.to(`partner:${partnerId}`).emit('partner:onboarding_status', payload);
  logger.info(`Event emitted: partner:onboarding_status for partner ${partnerId} - status: ${onboardingStatus}`);
  return true;
};

/**
 * Event 5: partner:payout
 * Emitted when delivery partner receives payout/earnings credit
 * Server → Client (Delivery Partner)
 */
export const emitPartnerPayout = (partnerId, payoutData) => {
  const io = getIO();
  if (!io) {
    logger.warn('Socket.IO not initialized for partner:payout event');
    return false;
  }

  const payload = {
    partnerId,
    amount: payoutData.amount,
    orderId: payoutData.orderId,
    type: payoutData.type || 'DELIVERY_FEE', // DELIVERY_FEE, BONUS, INCENTIVE
    description: payoutData.description || 'Earnings credited',
    newBalance: payoutData.newBalance,
    timestamp: new Date()
  };

  io.to(`partner:${partnerId}`).emit('partner:payout', payload);
  logger.info(`Event emitted: partner:payout for partner ${partnerId} - amount: ${payoutData.amount}`);
  return true;
};

/**
 * Setup delivery partner socket rooms and event listeners
 */
export const setupDeliveryPartnerSocketEvents = (io, socket) => {
  // Join partner's personal room
  socket.on('join:partner', (data) => {
    const partnerId = data?.partnerId || socket.user?.id;
    if (partnerId) {
      const roomName = `partner:${partnerId}`;
      socket.join(roomName);
      logger.info(`Socket ${socket.id} joined partner room ${roomName}`);
      socket.emit('subscribed:partner', { success: true, partnerId, room: roomName });
    }
  });

  // Leave partner's personal room
  socket.on('leave:partner', (data) => {
    const partnerId = data?.partnerId || socket.user?.id;
    if (partnerId) {
      const roomName = `partner:${partnerId}`;
      socket.leave(roomName);
      logger.info(`Socket ${socket.id} left partner room ${roomName}`);
    }
  });

  // Listen for location updates from delivery partner
  socket.on('partner:send_location', async (data) => {
    try {
      const partnerId = socket.user?.id;
      const { orderId, latitude, longitude } = data;

      if (!partnerId || !orderId || latitude === undefined || longitude === undefined) {
        return socket.emit('error', { message: 'Missing required fields: partnerId, orderId, latitude, longitude' });
      }

      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return socket.emit('error', { message: 'Invalid coordinates' });
      }

      // Update delivery location in DB
      await Delivery.findOneAndUpdate(
        { _id: orderId, deliveryPartnerId: partnerId },
        {
          currentLocation: {
            latitude,
            longitude,
            updatedAt: new Date()
          }
        }
      );

      // Update partner location in DB
      await DeliveryPartner.findByIdAndUpdate(partnerId, {
        currentLocation: {
          latitude,
          longitude,
          updatedAt: new Date()
        }
      });

      // Emit location update to order room
      emitPartnerLocationUpdate(orderId, partnerId, latitude, longitude);

      socket.emit('location:updated', { success: true });
    } catch (error) {
      logger.error(`Error handling partner:send_location: ${error.message}`);
      socket.emit('error', { message: 'Failed to update location' });
    }
  });

  // Listen for delivery status updates
  socket.on('delivery:update_status', async (data) => {
    try {
      const partnerId = socket.user?.id;
      const { orderId, status } = data;

      if (!partnerId || !orderId || !status) {
        return socket.emit('error', { message: 'Missing required fields' });
      }

      const validStatuses = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
      if (!validStatuses.includes(status)) {
        return socket.emit('error', { message: 'Invalid status' });
      }

      // Update delivery status
      const delivery = await Delivery.findOneAndUpdate(
        { _id: orderId, deliveryPartnerId: partnerId },
        { deliveryStatus: status, updatedAt: new Date() },
        { new: true }
      );

      if (!delivery) {
        return socket.emit('error', { message: 'Delivery not found' });
      }

      // Emit status change event
      emitOrderStatusChanged(delivery.orderId, orderId, status, partnerId);

      socket.emit('status:updated', { success: true, status });
    } catch (error) {
      logger.error(`Error handling delivery:update_status: ${error.message}`);
      socket.emit('error', { message: 'Failed to update status' });
    }
  });
};
