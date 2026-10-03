import express from 'express';
import { protectRestaurant } from '../../middleware/authMiddleware.js';
import { getRestaurantProfile, updateRestaurantProfile } from '../../controllers/restaurants/restaurantProfileController.js';

const router = express.Router();

router.use(protectRestaurant);

router.get('/', getRestaurantProfile);
router.put('/', updateRestaurantProfile);

export default router;
