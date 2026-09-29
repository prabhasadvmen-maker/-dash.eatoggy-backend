import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus
} from '../../controllers/super-admin/superAdminCouponController.js';

const router = express.Router();

router.use(protectSuperAdmin);

router.route('/')
  .get(getCoupons)
  .post(createCoupon);

router.route('/:id')
  .put(updateCoupon)
  .delete(deleteCoupon);

router.patch('/:id/status', toggleCouponStatus);

export default router;
