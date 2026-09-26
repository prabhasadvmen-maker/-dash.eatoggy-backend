import express from 'express';
import { protect, protectCustomer, protectRestaurant } from '../../middleware/authMiddleware.js';
import customerCtrl from '../../controllers/subscriptions/customerSubscriptionController.js';
import restaurantCtrl from '../../controllers/subscriptions/restaurantTiffinController.js';
import schedulerCtrl from '../../controllers/subscriptions/schedulerController.js';

const router = express.Router();

// ==========================================
// CUSTOMER PUBLIC DISCOVERY ROUTES
// ==========================================
router.get('/customers/tiffin-plans', customerCtrl.getPublicPlans);
router.get('/customers/tiffin-plans/:id', customerCtrl.getPlanDetail);

// ==========================================
// CUSTOMER PROTECTED SUBSCRIPTION ROUTES
// ==========================================
router.post('/customers/subscriptions', protectCustomer, customerCtrl.createSubscription);
router.post('/customers/subscriptions/verify-payment', protectCustomer, customerCtrl.verifySubscriptionPayment);
router.get('/customers/subscriptions', protectCustomer, customerCtrl.getMySubscriptions);
router.get('/customers/subscriptions/:id', protectCustomer, customerCtrl.getSubscriptionDetail);
router.patch('/customers/subscriptions/:id/pause', protectCustomer, customerCtrl.pauseSubscription);
router.patch('/customers/subscriptions/:id/resume', protectCustomer, customerCtrl.resumeSubscription);
router.patch('/customers/subscriptions/:id/cancel', protectCustomer, customerCtrl.cancelSubscription);
router.post('/customers/subscriptions/:id/occurrences/:occId/skip', protectCustomer, customerCtrl.skipOccurrence);

// ==========================================
// RESTAURANT TIFFIN PLAN MANAGEMENT ROUTES
// ==========================================
router.get('/restaurants/tiffin-plans', protectRestaurant, restaurantCtrl.getRestaurantPlans);
router.post('/restaurants/tiffin-plans', protectRestaurant, restaurantCtrl.createPlan);
router.patch('/restaurants/tiffin-plans/:id', protectRestaurant, restaurantCtrl.updatePlan);
router.patch('/restaurants/tiffin-plans/:id/status', protectRestaurant, restaurantCtrl.updateStatus);
router.delete('/restaurants/tiffin-plans/:id', protectRestaurant, restaurantCtrl.deletePlan);

// ==========================================
// SYSTEM / SCHEDULER ROUTE
// ==========================================
router.post('/subscriptions/scheduler/run', schedulerCtrl.runScheduler);

export default router;
