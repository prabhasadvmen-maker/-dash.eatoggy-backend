import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import * as superAdminRefundController from '../../controllers/super-admin/superAdminRefundController.js';

const router = express.Router();

router.use(protectSuperAdmin);

router.get('/refunds', superAdminRefundController.getAllRefunds);
router.get('/refunds/pending', superAdminRefundController.getPendingRefunds);
router.post('/refunds/:id/process', superAdminRefundController.processRefund);

export default router;
