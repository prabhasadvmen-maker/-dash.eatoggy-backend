import express from 'express';
import { protectCustomer } from '../../middleware/authMiddleware.js';
import {
  getCheckoutSummary,
  initiateCheckout,
  verifyPayment
} from '../../controllers/cart/checkoutController.js';

const router = express.Router();

router.use(protectCustomer);

router.get('/summary', getCheckoutSummary);
router.post('/initiate', initiateCheckout);
router.post('/verify-payment', verifyPayment);

export default router;
