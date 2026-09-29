import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import * as superAdminSettlementController from '../../controllers/super-admin/superAdminSettlementController.js';

const router = express.Router();

router.use(protectSuperAdmin);

router.get('/settlements', superAdminSettlementController.getAllSettlements);
router.get('/settlements/:id', superAdminSettlementController.getSettlementById);
router.patch('/settlements/:id/mark-paid', superAdminSettlementController.markSettlementPaid);
router.patch('/settlements/:id/mark-failed', superAdminSettlementController.markSettlementFailed);

export default router;
