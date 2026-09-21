import Settlement from '../../models/settlements/Settlement.js';
import Order from '../../models/orders/Order.js';
import Payment from '../../models/payments/Payment.js';

/**
 * Generate settlement statement for a restaurant partner for a given period.
 * Idempotent: Compound unique index + duplicate key catch ensures 1 record across concurrent threads.
 */
export const generateRestaurantSettlement = async ({ restaurantId, periodStart, periodEnd, commissionRate = 15 }) => {
  try {
    await Settlement.init();
  } catch (e) {
    // Ignore index initialization errors if collection contains legacy test duplicates
  }
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const existing = await Settlement.findOne({
    entityType: 'RESTAURANT',
    restaurantId,
    periodStart: start,
    periodEnd: end
  });
  if (existing) {
    return existing;
  }

  // Find all DELIVERED orders for this restaurant in period (REGULAR + SUBSCRIPTION)
  const orders = await Order.find({
    restaurant: restaurantId,
    orderStatus: 'DELIVERED',
    createdAt: { $gte: start, $lte: end }
  }).lean();

  // Find refunded payments for these orders
  const orderIds = orders.map(o => o._id);
  const refundedPayments = await Payment.find({
    order: { $in: orderIds },
    status: 'REFUNDED'
  }).lean();

  const refundedOrderMap = new Set(refundedPayments.map(p => p.order ? p.order.toString() : null));

  let grossEarnings = 0;
  let refundDeduction = 0;
  const eligibleOrderIds = [];

  for (const o of orders) {
    const isRefunded = refundedOrderMap.has(o._id.toString());
    const subtotal = o.pricing?.itemSubtotal || o.pricing?.subtotal || 0;

    if (isRefunded) {
      refundDeduction += subtotal;
    } else {
      grossEarnings += subtotal;
      eligibleOrderIds.push(o._id);
    }
  }

  const totalOrdersCount = eligibleOrderIds.length;
  const platformCommissionDeduction = Math.round((grossEarnings * commissionRate) / 100);
  const taxDeduction = Math.round(grossEarnings * 0.05); // 5% GST
  const netPayoutAmount = Math.max(0, grossEarnings - platformCommissionDeduction - taxDeduction);

  const settlementNumber = `STL-REST-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  try {
    const settlement = await Settlement.create({
      settlementNumber,
      entityType: 'RESTAURANT',
      restaurantId,
      periodStart: start,
      periodEnd: end,
      orderIds: eligibleOrderIds,
      totalOrdersCount,
      grossEarnings,
      platformCommissionRate: commissionRate,
      platformCommissionDeduction,
      taxDeduction,
      refundDeduction,
      netPayoutAmount,
      currency: 'INR',
      status: 'PENDING'
    });

    const allMatches = await Settlement.find({
      entityType: 'RESTAURANT',
      restaurantId,
      periodStart: start,
      periodEnd: end
    }).sort({ createdAt: 1 });

    if (allMatches.length > 1) {
      const winner = allMatches[0];
      if (settlement._id.toString() !== winner._id.toString()) {
        await Settlement.findByIdAndDelete(settlement._id);
        return winner;
      }
    }

    return settlement;
  } catch (error) {
    if (error.code === 11000) {
      // Return existing settlement on concurrent duplicate creation
      return await Settlement.findOne({
        entityType: 'RESTAURANT',
        restaurantId,
        periodStart: start,
        periodEnd: end
      });
    }
    throw error;
  }
};

/**
 * Generate settlement statement for a delivery partner for a given period.
 * Idempotent: Compound unique index + duplicate key catch ensures 1 record across concurrent threads.
 */
export const generateDeliveryPartnerSettlement = async ({ deliveryPartnerId, periodStart, periodEnd }) => {
  try {
    await Settlement.init();
  } catch (e) {
    // Ignore index initialization errors if collection contains legacy test duplicates
  }
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const existing = await Settlement.findOne({
    entityType: 'DELIVERY_PARTNER',
    deliveryPartnerId,
    periodStart: start,
    periodEnd: end
  });
  if (existing) {
    return existing;
  }

  // Find all DELIVERED jobs assigned to this rider in period
  const orders = await Order.find({
    $or: [
      { 'deliveryDetails.assignedPartner': deliveryPartnerId },
      { deliveryPartner: deliveryPartnerId }
    ],
    orderStatus: 'DELIVERED',
    createdAt: { $gte: start, $lte: end }
  }).lean();

  const totalOrdersCount = orders.length;
  const grossEarnings = orders.reduce((sum, o) => sum + (o.pricing?.deliveryFee || 40), 0);
  const taxDeduction = 0; // TDS / Tax withholding
  const netPayoutAmount = Math.max(0, grossEarnings - taxDeduction);

  const settlementNumber = `STL-RIDER-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  try {
    const settlement = await Settlement.create({
      settlementNumber,
      entityType: 'DELIVERY_PARTNER',
      deliveryPartnerId,
      periodStart: start,
      periodEnd: end,
      orderIds: orders.map(o => o._id),
      totalOrdersCount,
      grossEarnings,
      platformCommissionRate: 0,
      platformCommissionDeduction: 0,
      taxDeduction,
      netPayoutAmount,
      currency: 'INR',
      status: 'PENDING'
    });

    const allMatches = await Settlement.find({
      entityType: 'DELIVERY_PARTNER',
      deliveryPartnerId,
      periodStart: start,
      periodEnd: end
    }).sort({ createdAt: 1 });

    if (allMatches.length > 1) {
      const winner = allMatches[0];
      if (settlement._id.toString() !== winner._id.toString()) {
        await Settlement.findByIdAndDelete(settlement._id);
        return winner;
      }
    }

    return settlement;
  } catch (error) {
    if (error.code === 11000) {
      // Return existing settlement on concurrent duplicate creation
      return await Settlement.findOne({
        entityType: 'DELIVERY_PARTNER',
        deliveryPartnerId,
        periodStart: start,
        periodEnd: end
      });
    }
    throw error;
  }
};

/**
 * Fetch detailed single settlement record
 */
export const getSettlementById = async (settlementId) => {
  return await Settlement.findById(settlementId)
    .populate('restaurantId', 'restaurantName ownerName email mobile city')
    .populate('deliveryPartnerId', 'fullName mobile email')
    .populate('orderIds', 'orderNumber orderStatus pricing orderType createdAt')
    .lean();
};

/**
 * Fetch earnings summary & settlements list for a restaurant
 */
export const getRestaurantEarningsSummary = async (restaurantId) => {
  const settlements = await Settlement.find({ restaurantId }).sort({ createdAt: -1 }).lean();

  const totalPaid = settlements
    .filter(s => s.status === 'PAID')
    .reduce((sum, s) => sum + s.netPayoutAmount, 0);

  const totalPending = settlements
    .filter(s => s.status === 'PENDING' || s.status === 'PROCESSING')
    .reduce((sum, s) => sum + s.netPayoutAmount, 0);

  return {
    settlements,
    totalPaid,
    totalPending,
    settlementsCount: settlements.length
  };
};

/**
 * Fetch earnings summary & settlements list for a delivery partner
 */
export const getDeliveryPartnerEarningsSummary = async (deliveryPartnerId) => {
  const settlements = await Settlement.find({ deliveryPartnerId }).sort({ createdAt: -1 }).lean();

  const totalPaid = settlements
    .filter(s => s.status === 'PAID')
    .reduce((sum, s) => sum + s.netPayoutAmount, 0);

  const totalPending = settlements
    .filter(s => s.status === 'PENDING' || s.status === 'PROCESSING')
    .reduce((sum, s) => sum + s.netPayoutAmount, 0);

  return {
    settlements,
    totalPaid,
    totalPending,
    settlementsCount: settlements.length
  };
};

/**
 * Get all settlements for SuperAdmin with filtering
 */
export const getAllSettlementsForAdmin = async ({ entityType, status, page = 1, limit = 20 }) => {
  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const total = await Settlement.countDocuments(filter);
  const settlements = await Settlement.find(filter)
    .populate('restaurantId', 'restaurantName ownerName mobile')
    .populate('deliveryPartnerId', 'fullName mobile')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    settlements,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * State Machine Transition: Move PENDING -> PROCESSING
 */
export const processSettlement = async (settlementId) => {
  const settlement = await Settlement.findById(settlementId);
  if (!settlement) {
    throw new Error('Settlement record not found');
  }

  if (settlement.status !== 'PENDING' && settlement.status !== 'FAILED') {
    throw new Error(`Cannot process settlement with status ${settlement.status}`);
  }

  settlement.status = 'PROCESSING';
  settlement.processedAt = new Date();
  await settlement.save();
  return settlement;
};

/**
 * State Machine Transition: Mark PROCESSING / PENDING -> PAID
 */
export const markSettlementPaid = async (settlementId, { transactionReference, notes }) => {
  const settlement = await Settlement.findById(settlementId);
  if (!settlement) {
    throw new Error('Settlement record not found');
  }

  if (settlement.status === 'PAID') {
    throw new Error('Settlement is already marked as PAID');
  }

  settlement.status = 'PAID';
  settlement.transactionReference = transactionReference || `UTR_${Date.now()}`;
  if (notes) settlement.notes = notes;
  settlement.paidAt = new Date();
  await settlement.save();
  return settlement;
};

/**
 * State Machine Transition: Mark PROCESSING / PENDING -> FAILED
 */
export const markSettlementFailed = async (settlementId, { failureReason, notes }) => {
  const settlement = await Settlement.findById(settlementId);
  if (!settlement) {
    throw new Error('Settlement record not found');
  }

  if (settlement.status === 'PAID') {
    throw new Error('Cannot fail a settlement that is already PAID');
  }

  settlement.status = 'FAILED';
  settlement.failureReason = failureReason || 'Payout transfer failed';
  if (notes) settlement.notes = notes;
  await settlement.save();
  return settlement;
};
