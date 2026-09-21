import express from 'express';
import { protect, protectRestaurant, protectSuperAdmin } from '../../middleware/authMiddleware.js';
import {
  postReview,
  getMyCustomerReviews,
  getMyRestaurantReviews,
  postRestaurantReply,
  getAdminReviews,
  patchReviewStatus
} from '../../controllers/reviews/reviewController.js';

const router = express.Router();

// Customer endpoints
router.post('/customers/orders/:orderId/review', protect, postReview);
router.get('/customers/reviews', protect, getMyCustomerReviews);

// Restaurant endpoints
router.get('/restaurants/reviews', protectRestaurant, getMyRestaurantReviews);
router.post('/restaurants/reviews/:id/reply', protectRestaurant, postRestaurantReply);

// SuperAdmin moderation endpoints
router.get('/super-admin/reviews', protectSuperAdmin, getAdminReviews);
router.patch('/super-admin/reviews/:id/status', protectSuperAdmin, patchReviewStatus);

export default router;
