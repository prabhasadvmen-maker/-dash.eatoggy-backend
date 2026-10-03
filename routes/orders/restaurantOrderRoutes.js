import express from 'express';
import { protectRestaurant } from '../../middleware/authMiddleware.js';
import {
  getRestaurantOrders,
  getRestaurantOrderById,
  updateRestaurantOrderStatus,
  acceptOrder,
  rejectOrder,
  getOrderHistory,
  handoverOrder,
  toggleOnlineStatus
} from '../../controllers/orders/restaurantOrderController.js';

const router = express.Router();

router.use(protectRestaurant);

router.get('/', getRestaurantOrders);
router.patch('/status/toggle-online', toggleOnlineStatus);
router.get('/history', getOrderHistory);
router.get('/:id', getRestaurantOrderById);
router.patch('/:id/status', updateRestaurantOrderStatus);
router.post('/:orderId/accept', acceptOrder);
router.post('/:orderId/reject', rejectOrder);
router.post('/:orderId/handover', handoverOrder);

export default router;
