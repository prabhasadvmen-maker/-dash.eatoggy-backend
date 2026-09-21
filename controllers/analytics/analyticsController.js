import {
  getSuperAdminAnalyticsService,
  getRestaurantAnalyticsService,
  getDeliveryPartnerAnalyticsService
} from '../../services/analytics/analyticsService.js';

const getEntityId = (obj) => {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object') {
    return obj.id || obj._id || obj.restaurantId || obj.deliveryPartnerId || null;
  }
  return String(obj);
};

/**
 * SuperAdmin Overview Analytics
 * GET /api/super-admin/analytics/overview
 */
export const getSuperAdminAnalytics = async (req, res) => {
  try {
    const analytics = await getSuperAdminAnalyticsService(req.query);
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Restaurant Partner Analytics (Tenant Isolated)
 * GET /api/restaurants/analytics/overview
 */
export const getRestaurantAnalytics = async (req, res) => {
  try {
    const restaurantId =
      getEntityId(req.restaurant) ||
      getEntityId(req.user) ||
      getEntityId(req.customer);

    if (!restaurantId) {
      return res.status(403).json({ success: false, message: 'Restaurant identity context missing' });
    }
    const analytics = await getRestaurantAnalyticsService(restaurantId, req.query);
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delivery Partner Analytics (Tenant Isolated)
 * GET /api/delivery/analytics/overview
 */
export const getDeliveryAnalytics = async (req, res) => {
  try {
    const deliveryPartnerId =
      getEntityId(req.deliveryPartner) ||
      getEntityId(req.partner) ||
      getEntityId(req.user);

    if (!deliveryPartnerId) {
      return res.status(403).json({ success: false, message: 'Delivery Partner identity context missing' });
    }
    const analytics = await getDeliveryPartnerAnalyticsService(deliveryPartnerId, req.query);
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
