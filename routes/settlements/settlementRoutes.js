import express from 'express';
import { protectSuperAdmin, protectRestaurant, protectDeliveryPartner } from '../../middleware/authMiddleware.js';

import {
  getAdminSettlements,
  getAdminSettlementDetail,
  createSettlement,
  processSettlementController,
  markSettlementPaidController,
  markSettlementFailedController,
  getMyRestaurantEarnings,
  getMyRestaurantSettlementDetail,
  getMyDeliveryEarnings,
  getMyDeliverySettlementDetail
} from '../../controllers/settlements/settlementController.js';

const router = express.Router();

// ==========================================
// SUPERADMIN SETTLEMENT ENDPOINTS
// ==========================================
router.get('/super-admin/settlements', protectSuperAdmin, getAdminSettlements);
router.get('/super-admin/settlements/:id', protectSuperAdmin, getAdminSettlementDetail);
router.post('/super-admin/settlements/generate', protectSuperAdmin, createSettlement);
router.patch('/super-admin/settlements/:id/process', protectSuperAdmin, processSettlementController);
router.patch('/super-admin/settlements/:id/paid', protectSuperAdmin, markSettlementPaidController);
router.patch('/super-admin/settlements/:id/failed', protectSuperAdmin, markSettlementFailedController);

// Backward compatibility alias for legacy test specs/Postman
router.patch('/super-admin/settlements/:id/payout', protectSuperAdmin, markSettlementPaidController);

// ==========================================
// RESTAURANT PARTNER EARNINGS ENDPOINTS
// ==========================================
router.get('/restaurants/earnings', protectRestaurant, getMyRestaurantEarnings);
router.get('/restaurants/earnings/:id', protectRestaurant, getMyRestaurantSettlementDetail);

// ==========================================
// DELIVERY PARTNER EARNINGS ENDPOINTS
// ==========================================
router.get('/delivery/earnings/breakdown', protectDeliveryPartner, getMyDeliveryEarnings);
router.get('/delivery/earnings/summary', protectDeliveryPartner, getMyDeliveryEarnings);
router.get('/delivery/earnings', protectDeliveryPartner, getMyDeliveryEarnings);
router.get('/delivery/earnings/:id', protectDeliveryPartner, getMyDeliverySettlementDetail);

export default router;
