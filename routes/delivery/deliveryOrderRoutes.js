import express from 'express';
import { protectDeliveryPartner, protectCustomer } from '../../middleware/authMiddleware.js';
import * as deliveryOrderController from '../../controllers/delivery/deliveryOrderController.js';

const router = express.Router();

// Delivery Partner Routes
router.put('/availability', protectDeliveryPartner, deliveryOrderController.toggleAvailability);
router.get('/jobs/available', protectDeliveryPartner, deliveryOrderController.getAvailableJobs);
router.get('/available-jobs', protectDeliveryPartner, deliveryOrderController.getAvailableJobs);
router.get('/jobs/active', protectDeliveryPartner, deliveryOrderController.getActiveJob);
router.post('/jobs/:id/accept', protectDeliveryPartner, deliveryOrderController.acceptJob);
router.patch('/jobs/:id/status', protectDeliveryPartner, deliveryOrderController.updateStatus);
router.patch('/jobs/:id/location', protectDeliveryPartner, deliveryOrderController.updateLocation);
router.post('/jobs/:id/verify-otp', protectDeliveryPartner, deliveryOrderController.verifyOtpAndComplete);

// Customer Tracking Route (mounted under /api/customers/orders or /api/delivery/tracking)
router.get('/tracking/:id', protectCustomer, deliveryOrderController.getCustomerOrderTracking);

export default router;
