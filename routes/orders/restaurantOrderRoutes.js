import express from 'express';
import { protectRestaurant } from '../../middleware/authMiddleware.js';
import {
  getRestaurantOrders,
  getRestaurantOrderById,
  updateRestaurantOrderStatus,
  acceptOrder,
  rejectOrder
} from '../../controllers/orders/restaurantOrderController.js';

const router = express.Router();

router.use(protectRestaurant);

router.get('/', getRestaurantOrders);
router.get('/:id', getRestaurantOrderById);
router.patch('/:id/status', updateRestaurantOrderStatus);
router.post('/:orderId/accept', acceptOrder);
router.post('/:orderId/reject', rejectOrder);

export default router;
