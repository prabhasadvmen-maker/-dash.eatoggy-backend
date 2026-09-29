import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { env, logger } from './config/index.js';
import connectDB from './database/connection.js';
import mongoose from 'mongoose';
import { initSocketServer } from './realtime/socketServer.js';
import authRoutes from './routes/auth/auth.js';
import adminRoutes from './routes/admin/adminRoutes.js';
import restaurantAuthRoutes from './routes/restaurants/restaurantAuth.js';
import restaurantOnboardingRoutes from './routes/restaurants/restaurantOnboarding.js';
// import restaurantStaffRoutes from './routes/restaurants/restaurantStaff.js';
import restaurantMenuRoutes from './routes/restaurants/restaurantMenu.js';
import customerAuthRoutes from './routes/customers/customerAuth.js';
import customerDiscoveryRoutes from './routes/customers/customerDiscovery.js';
import customerCartRoutes from './routes/cart/cartRoutes.js';
import addressRoutes from './routes/customers/addressRoutes.js';
import checkoutRoutes from './routes/cart/checkoutRoutes.js';
import paymentRoutes from './routes/payments/paymentRoutes.js';
import customerOrderRoutes from './routes/orders/customerOrderRoutes.js';
import restaurantOrderRoutes from './routes/orders/restaurantOrderRoutes.js';
import kitchenOrderRoutes from './routes/orders/kitchenOrderRoutes.js';
import deliveryAuthRoutes from './routes/delivery/deliveryAuth.js';
import deliveryOnboardingRoutes from './routes/delivery/deliveryOnboarding.js';
import deliveryOrderRoutes from './routes/delivery/deliveryOrderRoutes.js';
import superAdminDeliveryRoutes from './routes/super-admin/superAdminDelivery.js';
import superAdminRestaurantRoutes from './routes/super-admin/superAdminRestaurant.js';
import superAdminMenuRoutes from './routes/super-admin/superAdminMenu.js';
import superAdminBannerRoutes from './routes/super-admin/superAdminBanners.js';
import superAdminControlRoutes from './routes/super-admin/superAdminControl.js';
import subscriptionRoutes from './routes/subscriptions/subscriptionRoutes.js';
import settlementRoutes from './routes/settlements/settlementRoutes.js';
import reviewRoutes from './routes/reviews/reviewRoutes.js';
import supportTicketRoutes from './routes/support/supportTicketRoutes.js';
import superAdminReportRoutes from './routes/super-admin/superAdminReportRoutes.js';
import analyticsRoutes from './routes/analytics/analyticsRoutes.js';
import superAdminRestaurantsRouter from './routes/super-admin/superAdminRestaurants.js';
import superAdminAdminsRouter from './routes/super-admin/superAdminAdmins.js';
import superAdminSettlementsRouter from './routes/super-admin/superAdminSettlements.js';
import superAdminReviewsRouter from './routes/super-admin/superAdminReviews.js';
import superAdminSupportRouter from './routes/super-admin/superAdminSupport.js';
import superAdminRefundsRouter from './routes/super-admin/superAdminRefunds.js';
import { startSubscriptionSchedulerJob, stopSubscriptionSchedulerJob } from './jobs/subscriptionSchedulerJob.js';
import { protect } from './middleware/authMiddleware.js';
import requestIdMiddleware from './middleware/requestId.js';
import notFoundHandler from './middleware/notFoundHandler.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO Server
initSocketServer(httpServer);

app.set('trust proxy', 1);
app.use(requestIdMiddleware);
app.use(helmet());

// Blocker 3: Strict Production CORS
const allowedOrigins = [
  env.FRONTEND_URL,
  'https://dash-eatoggy-frontend.vercel.app',
  'https://eatoggy.in',
  'https://www.eatoggy.in',
  'http://localhost:5173'
].filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Blocker 7: Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/restaurant-auth', restaurantAuthRoutes);
app.use('/api/restaurant-onboarding', restaurantOnboardingRoutes);
// app.use('/api/restaurants/staff', restaurantStaffRoutes);
app.use('/api/restaurants/menu', restaurantMenuRoutes);
app.use('/api/customer-auth', customerAuthRoutes);
app.use('/api/customers/discovery', customerDiscoveryRoutes);
app.use('/api/customers/addresses', addressRoutes);
app.use('/api/cart', customerCartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customers/orders', customerOrderRoutes);
app.use('/api/restaurants/orders', restaurantOrderRoutes);
app.use('/api/restaurants/kitchen', kitchenOrderRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', settlementRoutes);
app.use('/api', reviewRoutes);
app.use('/api', supportTicketRoutes);
app.use('/api', superAdminReportRoutes);
app.use('/api', analyticsRoutes);

// Delivery Partners Routes
app.use('/api/delivery-auth', deliveryAuthRoutes);
app.use('/api/delivery/onboarding', deliveryOnboardingRoutes);
app.use('/api/delivery', deliveryOrderRoutes);
app.use('/api/super-admin', superAdminDeliveryRoutes);
app.use('/api/super-admin', superAdminRestaurantRoutes);
app.use('/api/super-admin/menu', superAdminMenuRoutes);
app.use('/api/super-admin/banners', superAdminBannerRoutes);
app.use('/api/super-admin', superAdminControlRoutes);
app.use('/api/super-admin', superAdminRestaurantsRouter);
app.use('/api/super-admin', superAdminAdminsRouter);
app.use('/api/super-admin', superAdminSettlementsRouter);
app.use('/api/super-admin', superAdminReviewsRouter);
app.use('/api/super-admin', superAdminSupportRouter);
app.use('/api/super-admin', superAdminRefundsRouter);

app.get('/api/protected', protect, (req, res) => {
  res.json({ message: 'You have access to protected data!', admin: req.admin });
});

// Centralized 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

connectDB().then(() => {
  httpServer.listen(env.PORT, () => {
    logger.info(`Server & Socket.IO running on port ${env.PORT}`);
    startSubscriptionSchedulerJob();
  });
});

// Blocker 8: Graceful Shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new HTTP/Socket connections
  httpServer.close(() => {
    logger.info('HTTP & Socket.IO server closed.');
  });

  // Stop background scheduler
  stopSubscriptionSchedulerJob();

  // Close MongoDB
  try {
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed.');
  } catch (err) {
    logger.error('Error closing MongoDB connection', err);
  }

  logger.info('Graceful shutdown complete. Exiting process.');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


