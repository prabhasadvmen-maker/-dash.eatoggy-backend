import express from 'express';
import { protectCustomer } from '../../middleware/authMiddleware.js';
import { getOffers, applyCoupon } from '../../controllers/offers/offerController.js';

const router = express.Router();

router.get('/', getOffers);
router.post('/apply-coupon', protectCustomer, applyCoupon);

export default router;
