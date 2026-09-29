import express from 'express';
import { protectCustomer } from '../../middleware/authMiddleware.js';
import {
  getCustomerOrders,
  getCustomerOrderById,
  cancelOrder
} from '../../controllers/orders/customerOrderController.js';

const router = express.Router();

router.use(protectCustomer);

router.get('/', getCustomerOrders);
router.get('/:id', getCustomerOrderById);
router.post('/:orderId/cancel', cancelOrder);

export default router;
