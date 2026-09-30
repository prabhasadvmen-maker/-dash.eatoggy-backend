import express from 'express';
import { getOrderTracking } from '../../controllers/orders/orderTrackingController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:id', protectCustomer, getOrderTracking);

export default router;
