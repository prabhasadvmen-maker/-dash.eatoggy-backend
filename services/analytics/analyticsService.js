import Order from '../../models/orders/Order.js';
import Customer from '../../models/customers/Customer.js';
import Restaurant from '../../models/restaurants/Restaurant.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import Subscription from '../../models/subscriptions/Subscription.js';
import Review from '../../models/reviews/Review.js';
import SupportTicket from '../../models/support/SupportTicket.js';
import Settlement from '../../models/settlements/Settlement.js';
import Payment from '../../models/payments/Payment.js';

/**
 * Helper: Build Date Filter Object
 */
const buildDateFilter = (query) => {
  const { range, startDate, endDate } = query || {};
  const filter = {};
  const now = new Date();

  if (startDate && endDate) {
    filter.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
    return filter;
  }

  if (range === 'today') {
    const start = new Date(now.setHours(0, 0, 0, 0));
    filter.createdAt = { $gte: start };
  } else if (range === 'yesterday') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  } else if (range === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    filter.createdAt = { $gte: start };
  } else if (range === '30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    filter.createdAt = { $gte: start };
  } else if (range === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    filter.createdAt = { $gte: start };
  } else if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  }

  return filter;
};

/**
 * SuperAdmin Overview Analytics Service
 */
export const getSuperAdminAnalyticsService = async (query = {}) => {
  const dateFilter = buildDateFilter(query);

  // 1. Customer Metrics
  const totalCustomers = await Customer.countDocuments();
  const newCustomers = await Customer.countDocuments(dateFilter);

  // 2. Restaurant Metrics
  const totalRestaurants = await Restaurant.countDocuments();
  const activeRestaurants = await Restaurant.countDocuments({ onboardingStatus: 'APPROVED' });

  // 3. Delivery Partner Metrics
  const totalDeliveryPartners = await DeliveryPartner.countDocuments();
  const activeDeliveryPartners = await DeliveryPartner.countDocuments({ onboardingStatus: 'APPROVED' });

  // 4. Order Metrics (with Date Filter)
  const orderFilter = { ...dateFilter };
  const totalOrders = await Order.countDocuments(orderFilter);
  const deliveredOrders = await Order.countDocuments({ ...orderFilter, orderStatus: 'DELIVERED' });
  const cancelledOrders = await Order.countDocuments({ ...orderFilter, orderStatus: 'CANCELLED' });
  const pendingOrders = await Order.countDocuments({ ...orderFilter, orderStatus: { $in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } });
  const regularOrders = await Order.countDocuments({ ...orderFilter, orderType: { $ne: 'SUBSCRIPTION' } });
  const subscriptionOrders = await Order.countDocuments({ ...orderFilter, orderType: 'SUBSCRIPTION' });

  // 5. Financial Metrics
  const deliveredOrdersList = await Order.find({ ...orderFilter, orderStatus: 'DELIVERED' }).select('pricing').lean();
  const totalGMV = deliveredOrdersList.reduce((sum, o) => sum + (o.pricing?.finalTotal || 0), 0);
  const estimatedCommissionEarnings = Math.round(totalGMV * 0.15);
  const totalGST = deliveredOrdersList.reduce((sum, o) => sum + (o.pricing?.tax || 0), 0);

  const refundedPayments = await Payment.find({ ...dateFilter, status: 'REFUNDED' }).select('refundDetails').lean();
  const totalRefunds = refundedPayments.reduce((sum, p) => sum + (p.refundDetails?.refundAmount || p.amount || 0), 0);

  const settlementsList = await Settlement.find({ status: 'PAID' }).select('netPayoutAmount').lean();
  const totalPayoutsPaid = settlementsList.reduce((sum, s) => sum + (s.netPayoutAmount || 0), 0);

  // 6. Subscription Telemetry
  const totalSubscriptions = await Subscription.countDocuments();
  const activeSubscriptions = await Subscription.countDocuments({ status: 'ACTIVE' });
  const pausedSubscriptions = await Subscription.countDocuments({ status: 'PAUSED' });
  const cancelledSubscriptions = await Subscription.countDocuments({ status: 'CANCELLED' });

  // 7. Review Metrics
  const totalReviews = await Review.countDocuments();
  const publishedReviews = await Review.countDocuments({ status: 'PUBLISHED' });
  const flaggedReviews = await Review.countDocuments({ status: 'FLAGGED' });
  const hiddenReviews = await Review.countDocuments({ status: 'HIDDEN' });
  
  const avgRatingRes = await Review.aggregate([
    { $match: { status: 'PUBLISHED' } },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } }
  ]);
  const avgRating = avgRatingRes.length > 0 ? Number(avgRatingRes[0].avgRating.toFixed(1)) : 4.5;

  // 8. Support Ticket Metrics
  const totalTickets = await SupportTicket.countDocuments();
  const openTickets = await SupportTicket.countDocuments({ status: 'OPEN' });
  const inProgressTickets = await SupportTicket.countDocuments({ status: 'IN_PROGRESS' });
  const resolvedTickets = await SupportTicket.countDocuments({ status: 'RESOLVED' });
  const closedTickets = await SupportTicket.countDocuments({ status: 'CLOSED' });
  const urgentTickets = await SupportTicket.countDocuments({ priority: 'URGENT' });

  // 9. Time-Series Aggregations for SVG Charts (Daily Trend)
  const dailyTrends = await Order.aggregate([
    { $match: { ...orderFilter, orderStatus: 'DELIVERED' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.finalTotal' }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 30 }
  ]);

  const reviewRatingDistribution = await Review.aggregate([
    { $match: { status: 'PUBLISHED' } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return {
    dateRange: query.range || 'all',
    metrics: {
      totalGMV,
      estimatedCommissionEarnings,
      totalGST,
      totalRefunds,
      totalPayoutsPaid,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      regularOrders,
      subscriptionOrders,
      totalCustomers,
      newCustomers,
      totalRestaurants,
      activeRestaurants,
      totalDeliveryPartners,
      activeDeliveryPartners,
      totalSubscriptions,
      activeSubscriptions,
      pausedSubscriptions,
      cancelledSubscriptions,
      totalReviews,
      publishedReviews,
      flaggedReviews,
      hiddenReviews,
      avgRating,
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets
    },
    breakdowns: {
      dailyTrends,
      reviewRatingDistribution
    }
  };
};

/**
 * Restaurant Analytics Service (Tenant Isolated)
 */
export const getRestaurantAnalyticsService = async (restaurantId, query = {}) => {
  const dateFilter = buildDateFilter(query);
  const matchFilter = { restaurantId, ...dateFilter };

  const totalOrders = await Order.countDocuments(matchFilter);
  const deliveredOrders = await Order.countDocuments({ ...matchFilter, orderStatus: 'DELIVERED' });
  const cancelledOrders = await Order.countDocuments({ ...matchFilter, orderStatus: 'CANCELLED' });

  const deliveredOrdersList = await Order.find({ ...matchFilter, orderStatus: 'DELIVERED' }).select('pricing').lean();
  const totalRevenue = deliveredOrdersList.reduce((sum, o) => sum + (o.pricing?.finalTotal || 0), 0);
  const platformCommission = Math.round(totalRevenue * 0.15);
  const netEarnings = totalRevenue - platformCommission;
  const avgOrderValue = deliveredOrders > 0 ? Math.round(totalRevenue / deliveredOrders) : 0;

  const restaurantDoc = await Restaurant.findById(restaurantId).select('rating totalRatings').lean();
  const avgRating = restaurantDoc?.rating || 0;
  const totalReviews = restaurantDoc?.totalRatings || 0;

  const supportTicketsCount = await SupportTicket.countDocuments({ restaurantId });

  // Hourly trend for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const hourlyOrders = await Order.aggregate([
    { $match: { restaurantId, createdAt: { $gte: todayStart } } },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        orders: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return {
    metrics: {
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      platformCommission,
      netEarnings,
      avgOrderValue,
      avgRating,
      totalReviews,
      supportTicketsCount
    },
    hourlyOrders
  };
};

/**
 * Delivery Partner Analytics Service (Tenant Isolated)
 */
export const getDeliveryPartnerAnalyticsService = async (deliveryPartnerId, query = {}) => {
  const dateFilter = buildDateFilter(query);
  const matchFilter = { deliveryPartnerId, ...dateFilter };

  const assignedDeliveries = await Order.countDocuments(matchFilter);
  const completedDeliveries = await Order.countDocuments({ ...matchFilter, deliveryStatus: 'DELIVERED' });
  const cancelledDeliveries = await Order.countDocuments({ ...matchFilter, deliveryStatus: 'CANCELLED' });

  const completedList = await Order.find({ ...matchFilter, deliveryStatus: 'DELIVERED' }).select('pricingSnapshot').lean();
  const totalEarnings = completedList.reduce((sum, o) => sum + (o.pricingSnapshot?.deliveryFee || 35), 0);

  const partnerDoc = await DeliveryPartner.findById(deliveryPartnerId).select('rating').lean();
  const avgRating = partnerDoc?.rating || 5.0;

  const supportTicketsCount = await SupportTicket.countDocuments({ deliveryPartnerId });

  return {
    metrics: {
      assignedDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      totalEarnings,
      avgRating,
      supportTicketsCount
    }
  };
};
