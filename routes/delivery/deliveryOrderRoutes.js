import express from 'express';
import { protectDeliveryPartner, protectCustomer } from '../../middleware/authMiddleware.js';
import * as deliveryOrderController from '../../controllers/delivery/deliveryOrderController.js';
import * as deliveryDashboardController from '../../controllers/delivery/deliveryDashboardController.js';
import * as lifecycleController from '../../controllers/delivery/deliveryOrderLifecycleController.js';
import * as navigationController from '../../controllers/delivery/deliveryNavigationController.js';
import * as zoneController from '../../controllers/delivery/deliveryZoneController.js';
import * as appController from '../../controllers/delivery/deliveryAppController.js';

const router = express.Router();

// Delivery Partner Dashboard, Location & Profile Routes
router.get('/dashboard', protectDeliveryPartner, deliveryDashboardController.getDashboard);
router.put('/partner/status', protectDeliveryPartner, deliveryDashboardController.updatePartnerStatus);
router.get('/orders/today', protectDeliveryPartner, deliveryDashboardController.getTodaysOrders);
router.put('/partner/location', protectDeliveryPartner, navigationController.updateLocation);
router.put('/partner/profile', protectDeliveryPartner, appController.updateProfile);

// Delivery Partner Earnings Routes — static sub-routes MUST come before /:id
router.get('/earnings/breakdown', protectDeliveryPartner, appController.getEarnings);
router.get('/earnings/summary', protectDeliveryPartner, appController.getEarnings);
router.get('/earnings', protectDeliveryPartner, appController.getEarnings);
router.post('/earnings/withdraw', protectDeliveryPartner, appController.withdrawEarnings);

// Wallet Routes
router.get('/wallet', protectDeliveryPartner, appController.getWallet);
router.post('/wallet/payout', protectDeliveryPartner, appController.walletPayout);

// Delivery Partner Notifications Routes
router.get('/notifications', protectDeliveryPartner, appController.getNotifications);
router.put('/notifications/read-all', protectDeliveryPartner, appController.markAllNotificationsRead);
router.put('/notifications/:notifId/read', protectDeliveryPartner, appController.markNotificationRead);

// Delivery Partner Support Routes
router.get('/support/faqs', protectDeliveryPartner, appController.getFAQs);
router.get('/support/tickets', protectDeliveryPartner, appController.getSupportTickets);
router.post('/support/ticket', protectDeliveryPartner, appController.submitSupportTicket);

// Delivery Partner Zone Routes
router.get('/partner/zone', protectDeliveryPartner, zoneController.getZoneData);
router.get('/partner/zone/subscribers', protectDeliveryPartner, zoneController.getZoneSubscribers);

// Delivery Lifecycle Routes
router.get('/orders/history', protectDeliveryPartner, lifecycleController.getOrderHistory);
router.get('/orders/:orderId', protectDeliveryPartner, lifecycleController.getOrderDetails);
router.get('/orders/:orderId/navigation', protectDeliveryPartner, navigationController.getNavigationData);
router.post('/orders/:orderId/accept', protectDeliveryPartner, lifecycleController.acceptOrder);
router.post('/orders/:orderId/reject', protectDeliveryPartner, lifecycleController.rejectOrder);
router.post('/orders/:orderId/confirm-pickup', protectDeliveryPartner, lifecycleController.confirmPickup);
router.post('/orders/:orderId/verify-otp', protectDeliveryPartner, lifecycleController.verifyOtp);
router.post('/orders/:orderId/complete', protectDeliveryPartner, lifecycleController.completeDelivery);
router.post('/orders/:orderId/report-issue', protectDeliveryPartner, lifecycleController.reportIssue);

// Delivery Partner Jobs Routes
router.put('/availability', protectDeliveryPartner, deliveryOrderController.toggleAvailability);
router.get('/jobs/available', protectDeliveryPartner, deliveryOrderController.getAvailableJobs);
router.get('/available-jobs', protectDeliveryPartner, deliveryOrderController.getAvailableJobs);
router.get('/jobs/active', protectDeliveryPartner, deliveryOrderController.getActiveJob);
router.post('/jobs/:id/accept', protectDeliveryPartner, deliveryOrderController.acceptJob);
router.patch('/jobs/:id/status', protectDeliveryPartner, deliveryOrderController.updateStatus);
router.patch('/jobs/:id/location', protectDeliveryPartner, deliveryOrderController.updateLocation);
router.post('/jobs/:id/verify-otp', protectDeliveryPartner, deliveryOrderController.verifyOtpAndComplete);

// Customer Tracking Route
router.get('/tracking/:id', protectCustomer, deliveryOrderController.getCustomerOrderTracking);

export default router;
