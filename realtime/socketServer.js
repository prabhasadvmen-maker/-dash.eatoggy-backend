import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Order from '../models/orders/Order.js';
import Delivery from '../models/delivery/Delivery.js';
import Subscription from '../models/subscriptions/Subscription.js';
import { env, logger } from '../config/index.js';
import { setupDeliveryPartnerSocketEvents } from './deliveryPartnerEvents.js';

let io = null;

/**
 * Initialize Socket.IO Server with JWT authentication and room authorization
 */
export const initSocketServer = (httpServer) => {
  // Blocker 5: Enforce Single-instance deployment constraint
  if (process.env.NODE_APP_INSTANCE && process.env.NODE_APP_INSTANCE !== '0') {
    const msg = 'CRITICAL: Socket.IO is running in PM2 Cluster mode without @socket.io/redis-adapter. Realtime features will break. Please use single-instance deployment.';
    logger.error(msg);
    if (process.env.NODE_ENV === 'production') throw new Error(msg);
  }

  io = new Server(httpServer, {
    cors: {
      origin: [
        env.FRONTEND_URL,
        'https://dash-eatoggy-frontend.vercel.app',
        'https://eatoggy.in',
        'https://www.eatoggy.in',
        'http://localhost:5173'
      ].filter(Boolean),
      methods: ['GET', 'POST', 'PATCH', 'PUT']
    }
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const secret = env.JWT_SECRET || process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('Server authentication configuration error'));
      }

      const decoded = jwt.verify(token, secret);
      const user = decoded.restaurant || decoded.customer || decoded.deliveryPartner || decoded.user || decoded.admin;

      if (!user) {
        return next(new Error('Authentication error: User context invalid'));
      }

      socket.user = {
        id: user.id || user._id,
        role: user.role || (decoded.restaurant ? 'Restaurant' : decoded.customer ? 'Customer' : decoded.deliveryPartner ? 'DeliveryPartner' : 'User')
      };

      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user?.id}, Role: ${socket.user?.role})`);

    // Setup delivery partner socket events
    if (socket.user?.role === 'DeliveryPartner') {
      setupDeliveryPartnerSocketEvents(io, socket);
    }
    socket.on('join:order', async (data) => {
      try {
        const orderId = typeof data === 'string' ? data : data?.orderId;
        if (!orderId) {
          return socket.emit('error', { message: 'Order ID is required to join tracking room' });
        }

        const userId = socket.user.id;
        const userRole = socket.user.role;

        let authorized = false;

        if (userRole === 'Customer') {
          const order = await Order.findOne({ _id: orderId, customerId: userId });
          if (order) authorized = true;
        } else if (userRole === 'Restaurant') {
          const order = await Order.findOne({ _id: orderId, restaurantId: userId });
          if (order) authorized = true;
        } else if (userRole === 'DeliveryPartner') {
          const delivery = await Delivery.findOne({ orderId, deliveryPartnerId: userId });
          if (delivery) authorized = true;
        } else if (userRole === 'SuperAdmin' || userRole === 'Admin') {
          authorized = true;
        }

        if (!authorized) {
          return socket.emit('error', { message: 'Unauthorized access to order tracking room' });
        }

        const roomName = `order:${orderId}`;
        socket.join(roomName);
        logger.info(`Socket ${socket.id} joined room ${roomName}`);

        socket.emit('subscribed:order', { success: true, orderId, room: roomName });
      } catch (err) {
        logger.error(`Socket join:order error: ${err.message}`);
        socket.emit('error', { message: 'Failed to join order tracking room' });
      }
    });

    // Join subscription room with IDOR authorization
    socket.on('join:subscription', async (data) => {
      try {
        const subscriptionId = typeof data === 'string' ? data : data?.subscriptionId;
        if (!subscriptionId) {
          return socket.emit('error', { message: 'Subscription ID is required to join room' });
        }

        const userId = socket.user.id;
        const userRole = socket.user.role;

        let authorized = false;

        if (userRole === 'Customer') {
          const subscription = await Subscription.findOne({ _id: subscriptionId, customerId: userId });
          if (subscription) authorized = true;
        } else if (userRole === 'Restaurant') {
          const subscription = await Subscription.findOne({ _id: subscriptionId, restaurantId: userId });
          if (subscription) authorized = true;
        } else if (userRole === 'SuperAdmin' || userRole === 'Admin') {
          authorized = true;
        }

        if (!authorized) {
          return socket.emit('error', { message: 'Unauthorized access to subscription room' });
        }

        const roomName = `subscription:${subscriptionId}`;
        socket.join(roomName);
        logger.info(`Socket ${socket.id} joined room ${roomName}`);

        socket.emit('subscribed:subscription', { success: true, subscriptionId, room: roomName });
      } catch (err) {
        logger.error(`Socket join:subscription error: ${err.message}`);
        socket.emit('error', { message: 'Failed to join subscription room' });
      }
    });

    // Join restaurant kitchen room with authorization
    socket.on('join:restaurant', async (data) => {
      try {
        const restaurantId = typeof data === 'string' ? data : data?.restaurantId;
        if (!restaurantId) {
          return socket.emit('error', { message: 'Restaurant ID is required to join kitchen room' });
        }

        const userId = socket.user.id;
        const userRole = socket.user.role;

        let authorized = false;
        if (userRole === 'Restaurant' && userId.toString() === restaurantId.toString()) {
          authorized = true;
        } else if (userRole === 'SuperAdmin' || userRole === 'Admin') {
          authorized = true;
        }

        if (!authorized) {
          return socket.emit('error', { message: 'Unauthorized access to restaurant kitchen room' });
        }

        const roomName = `restaurant:${restaurantId}`;
        socket.join(roomName);
        logger.info(`Socket ${socket.id} joined room ${roomName}`);

        socket.emit('subscribed:restaurant', { success: true, restaurantId, room: roomName });
      } catch (err) {
        logger.error(`Socket join:restaurant error: ${err.message}`);
        socket.emit('error', { message: 'Failed to join restaurant room' });
      }
    });

    // Leave order tracking room
    socket.on('leave:order', (data) => {
      const orderId = typeof data === 'string' ? data : data?.orderId;
      if (orderId) {
        const roomName = `order:${orderId}`;
        socket.leave(roomName);
        logger.info(`Socket ${socket.id} left room ${roomName}`);
      }
    });

    // Leave subscription room
    socket.on('leave:subscription', (data) => {
      const subscriptionId = typeof data === 'string' ? data : data?.subscriptionId;
      if (subscriptionId) {
        const roomName = `subscription:${subscriptionId}`;
        socket.leave(roomName);
        logger.info(`Socket ${socket.id} left room ${roomName}`);
      }
    });

    // Leave restaurant room
    socket.on('leave:restaurant', (data) => {
      const restaurantId = typeof data === 'string' ? data : data?.restaurantId;
      if (restaurantId) {
        const roomName = `restaurant:${restaurantId}`;
        socket.leave(roomName);
        logger.info(`Socket ${socket.id} left room ${roomName}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Emit event to order room
 */
export const emitToOrderRoom = (orderId, event, payload) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, skipping realtime emit');
    return false;
  }
  const roomName = `order:${orderId}`;
  io.to(roomName).emit(event, payload);
  return true;
};

/**
 * Emit event to subscription room
 */
export const emitToSubscriptionRoom = (subscriptionId, event, payload) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, skipping realtime emit');
    return false;
  }
  const roomName = `subscription:${subscriptionId}`;
  io.to(roomName).emit(event, payload);
  return true;
};

/**
 * Emit event to restaurant kitchen room
 */
export const emitToRestaurantRoom = (restaurantId, event, payload) => {
  if (!io) {
    logger.warn('Socket.IO not initialized, skipping realtime emit');
    return false;
  }
  const roomName = `restaurant:${restaurantId}`;
  io.to(roomName).emit(event, payload);
  return true;
};

export const getIO = () => io;
