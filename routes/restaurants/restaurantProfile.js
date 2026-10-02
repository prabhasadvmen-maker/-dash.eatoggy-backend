import express from 'express';
import { protectRestaurant } from '../../middleware/authMiddleware.js';
import { getRestaurantProfile } from '../../controllers/restaurants/restaurantProfileController.js';

const router = express.Router();

router.use(protectRestaurant);

router.get('/', getRestaurantProfile);

export default router;
