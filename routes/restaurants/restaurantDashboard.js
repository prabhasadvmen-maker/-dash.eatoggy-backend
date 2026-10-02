import express from 'express';
import { protectRestaurant } from '../../middleware/authMiddleware.js';
import { getDashboardData } from '../../controllers/restaurants/restaurantDashboardController.js';

const router = express.Router();

router.use(protectRestaurant);

router.get('/', getDashboardData);

export default router;
