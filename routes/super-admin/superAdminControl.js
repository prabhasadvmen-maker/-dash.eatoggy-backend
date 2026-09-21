import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';

import {
  getAllCustomers,
  getCustomerById,
  toggleCustomerStatus
} from '../../controllers/super-admin/superAdminCustomerController.js';

import {
  getAllOrders,
  getOrderDetails
} from '../../controllers/super-admin/superAdminOrderController.js';

import {
  getAllSubscriptions,
  getSubscriptionDetails,
  cancelSubscription,
  pauseSubscription
} from '../../controllers/super-admin/superAdminSubscriptionController.js';

import {
  getAllPayments,
  initiateRefund
} from '../../controllers/super-admin/superAdminPaymentController.js';

const router = express.Router();

// Enforce SuperAdmin RBAC middleware on all routes
router.use(protectSuperAdmin);

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================
router.get('/customers', getAllCustomers);
router.get('/customers/:id', getCustomerById);
router.patch('/customers/:id/status', toggleCustomerStatus);

// ==========================================
// MASTER ORDERS MONITORING
// ==========================================
router.get('/orders', getAllOrders);
router.get('/orders/:id', getOrderDetails);

// ==========================================
// MASTER SUBSCRIPTIONS VIEW
// ==========================================
router.get('/subscriptions', getAllSubscriptions);
router.get('/subscriptions/:id', getSubscriptionDetails);
router.patch('/subscriptions/:id/cancel', cancelSubscription);
router.patch('/subscriptions/:id/pause', pauseSubscription);

// ==========================================
// PAYMENTS & REFUNDS AUDIT
// ==========================================
router.get('/payments', getAllPayments);
router.post('/payments/:id/refund', initiateRefund);

export default router;
