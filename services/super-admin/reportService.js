import Order from '../../models/orders/Order.js';
import Customer from '../../models/customers/Customer.js';
import Restaurant from '../../models/restaurants/Restaurant.js';
import Subscription from '../../models/subscriptions/Subscription.js';
import Settlement from '../../models/settlements/Settlement.js';
import PlatformSettings from '../../models/super-admin/PlatformSettings.js';
import PlatformSettingsHistory from '../../models/super-admin/PlatformSettingsHistory.js';

/**
 * Generate platform analytics and financial reporting metrics
 */
export const getPlatformAnalyticsReportService = async () => {
  const totalOrders = await Order.countDocuments();
  const deliveredOrders = await Order.countDocuments({ orderStatus: 'DELIVERED' });
  const totalCustomers = await Customer.countDocuments();
  const totalRestaurants = await Restaurant.countDocuments();
  const activeSubscriptions = await Subscription.countDocuments({ status: 'ACTIVE' });

  const deliveredOrdersList = await Order.find({ orderStatus: 'DELIVERED' }).select('pricing').lean();
  const totalGMV = deliveredOrdersList.reduce((sum, o) => sum + (o.pricing?.grandTotal || 0), 0);
  const estimatedCommissionEarnings = Math.round(totalGMV * 0.15);

  const settlementsList = await Settlement.find().lean();
  const totalPayoutsPaid = settlementsList
    .filter(s => s.status === 'PAID')
    .reduce((sum, s) => sum + s.netPayoutAmount, 0);

  return {
    metrics: {
      totalGMV,
      estimatedCommissionEarnings,
      totalPayoutsPaid,
      totalOrders,
      deliveredOrders,
      totalCustomers,
      totalRestaurants,
      activeSubscriptions
    }
  };
};

/**
 * Fetch or initialize platform settings
 */
export const getPlatformSettingsService = async () => {
  let settings = await PlatformSettings.findOne();
  if (!settings) {
    settings = await PlatformSettings.create({});
  }
  return settings;
};

/**
 * Update platform settings & log audit history
 */
export const updatePlatformSettingsService = async (updateData, adminUser = null) => {
  let settings = await PlatformSettings.findOne();
  if (!settings) {
    settings = await PlatformSettings.create(updateData);
    // Create initial audit log
    for (const [key, val] of Object.entries(updateData)) {
      if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt') {
        await PlatformSettingsHistory.create({
          settingKey: key,
          oldValue: null,
          newValue: val,
          changedBy: adminUser?.id || adminUser?._id || null,
          changedByEmail: adminUser?.email || 'superadmin@eatoggy.com'
        });
      }
    }
  } else {
    // Log history for modified fields
    for (const [key, val] of Object.entries(updateData)) {
      if (key !== '_id' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt') {
        const oldVal = settings[key];
        if (oldVal !== val && val !== undefined) {
          await PlatformSettingsHistory.create({
            settingKey: key,
            oldValue: oldVal,
            newValue: val,
            changedBy: adminUser?.id || adminUser?._id || null,
            changedByEmail: adminUser?.email || 'superadmin@eatoggy.com'
          });
        }
      }
    }
    Object.assign(settings, updateData);
    await settings.save();
  }
  return settings;
};

/**
 * Fetch platform settings audit history log
 */
export const getPlatformSettingsHistoryService = async (limit = 50) => {
  return await PlatformSettingsHistory.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};
