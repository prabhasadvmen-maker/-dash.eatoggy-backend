import {
  generateRestaurantSettlement,
  generateDeliveryPartnerSettlement,
  getRestaurantEarningsSummary,
  getDeliveryPartnerEarningsSummary,
  getAllSettlementsForAdmin,
  getSettlementById,
  processSettlement,
  markSettlementPaid,
  markSettlementFailed
} from '../../services/settlements/settlementService.js';

/**
 * SuperAdmin: List all settlements (paginated & filtered)
 * @route GET /api/super-admin/settlements
 */
export const getAdminSettlements = async (req, res) => {
  try {
    const { entityType, status, page = 1, limit = 20 } = req.query;
    const result = await getAllSettlementsForAdmin({ entityType, status, page, limit });
    res.json({ success: true, data: result.settlements, pagination: result.pagination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Get single detailed settlement
 * @route GET /api/super-admin/settlements/:id
 */
export const getAdminSettlementDetail = async (req, res) => {
  try {
    const settlement = await getSettlementById(req.params.id);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement record not found' });
    }
    res.json({ success: true, data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Generate a new settlement for restaurant or delivery partner
 * @route POST /api/super-admin/settlements/generate
 */
export const createSettlement = async (req, res) => {
  try {
    const { entityType = 'RESTAURANT', restaurantId, deliveryPartnerId, periodStart, periodEnd, commissionRate } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ success: false, message: 'periodStart and periodEnd are required' });
    }

    let settlement;
    if (entityType === 'DELIVERY_PARTNER') {
      if (!deliveryPartnerId) {
        return res.status(400).json({ success: false, message: 'deliveryPartnerId is required for delivery partner settlement' });
      }
      settlement = await generateDeliveryPartnerSettlement({ deliveryPartnerId, periodStart, periodEnd });
    } else {
      if (!restaurantId) {
        return res.status(400).json({ success: false, message: 'restaurantId is required for restaurant settlement' });
      }
      settlement = await generateRestaurantSettlement({ restaurantId, periodStart, periodEnd, commissionRate });
    }

    res.status(201).json({ success: true, message: 'Settlement statement generated successfully', data: settlement });
  } catch (error) {
    console.error('[Settlement Create Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Move settlement status to PROCESSING
 * @route PATCH /api/super-admin/settlements/:id/process
 */
export const processSettlementController = async (req, res) => {
  try {
    const settlement = await processSettlement(req.params.id);
    res.json({ success: true, message: 'Settlement processing started', data: settlement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Mark settlement as PAID
 * @route PATCH /api/super-admin/settlements/:id/paid
 */
export const markSettlementPaidController = async (req, res) => {
  try {
    const { transactionReference, notes } = req.body;
    const settlement = await markSettlementPaid(req.params.id, { transactionReference, notes });
    res.json({ success: true, message: 'Settlement marked as PAID', data: settlement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Mark settlement as FAILED
 * @route PATCH /api/super-admin/settlements/:id/failed
 */
export const markSettlementFailedController = async (req, res) => {
  try {
    const { failureReason, notes } = req.body;
    const settlement = await markSettlementFailed(req.params.id, { failureReason, notes });
    res.json({ success: true, message: 'Settlement status updated to FAILED', data: settlement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Restaurant Partner: Fetch my earnings summary & payout statements
 * @route GET /api/restaurants/earnings
 */
export const getMyRestaurantEarnings = async (req, res) => {
  try {
    const restaurantId = req.restaurant?.id || req.restaurant?._id || req.user?.id || req.user?._id;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Restaurant partner identity missing' });
    }

    const data = await getRestaurantEarningsSummary(restaurantId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Restaurant Partner: Fetch single settlement statement detail (IDOR Protected)
 * @route GET /api/restaurants/earnings/:id
 */
export const getMyRestaurantSettlementDetail = async (req, res) => {
  try {
    const restaurantId = req.restaurant?.id || req.restaurant?._id || req.user?.id || req.user?._id;
    const settlement = await getSettlementById(req.params.id);

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement record not found' });
    }

    if (!settlement.restaurantId || settlement.restaurantId._id.toString() !== restaurantId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized access to settlement' });
    }

    res.json({ success: true, data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delivery Partner: Fetch my earnings summary & payout statements
 * @route GET /api/delivery/earnings
 */
export const getMyDeliveryEarnings = async (req, res) => {
  try {
    const deliveryPartnerId = req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
    if (!deliveryPartnerId) {
      return res.status(400).json({ success: false, message: 'Delivery partner identity missing' });
    }

    const data = await getDeliveryPartnerEarningsSummary(deliveryPartnerId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delivery Partner: Fetch single settlement statement detail (IDOR Protected)
 * @route GET /api/delivery/earnings/:id
 */
export const getMyDeliverySettlementDetail = async (req, res) => {
  try {
    const deliveryPartnerId = req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
    const settlement = await getSettlementById(req.params.id);

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement record not found' });
    }

    if (!settlement.deliveryPartnerId || settlement.deliveryPartnerId._id.toString() !== deliveryPartnerId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized access to settlement' });
    }

    res.json({ success: true, data: settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
