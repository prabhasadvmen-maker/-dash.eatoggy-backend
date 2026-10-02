import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import Order from '../../models/orders/Order.js';
import MenuItem from '../../models/menu/MenuItem.js';
import Wallet from '../../models/wallet/Wallet.js';

export const getDashboardData = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.restaurant?._id || req.user?.id || req.user?._id;
  
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Orders stats
  const totalOrders = await Order.countDocuments({ restaurantId });
  const todayOrders = await Order.countDocuments({ restaurantId, createdAt: { $gte: today } });
  const deliveredOrders = await Order.countDocuments({ restaurantId, orderStatus: 'DELIVERED' });
  const cancelledOrders = await Order.countDocuments({ restaurantId, orderStatus: { $in: ['CANCELLED', 'REJECTED'] } });
  const pendingOrders = await Order.countDocuments({ restaurantId, orderStatus: { $in: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } });

  // Revenue stats
  const deliveredOrderDocs = await Order.find({ restaurantId, orderStatus: 'DELIVERED' }).select('pricing createdAt');
  
  let totalRevenue = 0;
  let todayRevenue = 0;

  deliveredOrderDocs.forEach(order => {
    const amount = order.pricing?.grandTotal || 0;
    totalRevenue += amount;
    if (new Date(order.createdAt) >= today) {
      todayRevenue += amount;
    }
  });

  const avgOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0;

  // Menu items stats
  const activeMenuItems = await MenuItem.countDocuments({ restaurantId, isActive: true });

  // Wallet stats
  let wallet = await Wallet.findOne({ restaurantId });
  if (!wallet) {
    wallet = await Wallet.create({ restaurantId });
  }

  const data = {
    metrics: {
      totalOrders,
      todayOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      totalRevenue,
      todayRevenue,
      avgOrderValue: Math.round(avgOrderValue),
      avgRating: 4.5,
      totalReviews: 89,
      activeMenuItems,
      walletBalance: wallet.currentBalance
    }
  };

  return successResponse(res, {
    statusCode: 200,
    message: 'Dashboard data retrieved successfully',
    data
  });
});
