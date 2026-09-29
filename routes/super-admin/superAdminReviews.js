import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import * as superAdminReviewController from '../../controllers/super-admin/superAdminReviewController.js';

const router = express.Router();

router.use(protectSuperAdmin);

router.get('/reviews', superAdminReviewController.getAllReviews);
router.patch('/reviews/:id/hide', superAdminReviewController.hideReview);
router.patch('/reviews/:id/publish', superAdminReviewController.publishReview);
router.patch('/reviews/:id/flag', superAdminReviewController.flagReview);
router.delete('/reviews/:id', superAdminReviewController.deleteReview);

export default router;
