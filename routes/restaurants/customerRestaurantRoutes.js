import express from 'express';
import { getRestaurantMenu } from '../../controllers/restaurants/restaurantMenuController.js';

const router = express.Router();

router.get('/:id/menu', getRestaurantMenu);

export default router;
