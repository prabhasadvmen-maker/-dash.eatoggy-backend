import express from 'express';
import { protectSuperAdmin, protectAdmin, protectRestaurant, protectDeliveryPartner } from '../../middleware/authMiddleware.js';
import {
  getSuperAdminAnalytics,
  getRestaurantAnalytics,
  getDeliveryAnalytics
} from '../../controllers/analytics/analyticsController.js';

const router = express.Router();

router.get('/super-admin/analytics/overview', protectSuperAdmin, getSuperAdminAnalytics);
router.get('/admin/analytics/overview', protectAdmin, getSuperAdminAnalytics);
router.get('/restaurants/analytics/overview', protectRestaurant, getRestaurantAnalytics);
router.get('/delivery/analytics/overview', protectDeliveryPartner, getDeliveryAnalytics);

export default router;
