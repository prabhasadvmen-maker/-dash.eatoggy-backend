import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import * as superAdminRestaurantController from '../../controllers/super-admin/superAdminRestaurantController.js';

const router = express.Router();

router.use(protectSuperAdmin);

router.get('/restaurants', superAdminRestaurantController.getAllRestaurants);
router.get('/restaurants/:id', superAdminRestaurantController.getRestaurantById);
router.patch('/restaurants/:id/approve', superAdminRestaurantController.approveRestaurant);
router.patch('/restaurants/:id/reject', superAdminRestaurantController.rejectRestaurant);
router.patch('/restaurants/:id/suspend', superAdminRestaurantController.suspendRestaurant);
router.patch('/restaurants/:id/unsuspend', superAdminRestaurantController.unsuspendRestaurant);

export default router;
