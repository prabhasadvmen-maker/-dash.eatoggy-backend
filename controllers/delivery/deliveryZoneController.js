import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import CityZone from '../../models/super-admin/CityZone.js';
import Subscription from '../../models/subscriptions/Subscription.js';
import SubscriptionOccurrence from '../../models/subscriptions/SubscriptionOccurrence.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

const getPartnerId = (req) => {
  return req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
};

/**
 * @desc Get partner's assigned tiffin zone and today's route
 * @route GET /api/delivery/partner/zone
 * @access Private (Delivery Partner)
 */
export const getZoneData = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const partner = await DeliveryPartner.findById(partnerId).lean();

    if (!partner) {
      return errorResponse(res, { statusCode: 404, message: 'Partner not found' });
    }

    if (!partner.zone) {
      return errorResponse(res, { statusCode: 400, message: 'No assigned zone for this partner' });
    }

    // Try to find zone details in CityZone collection
    const cityZones = await CityZone.find().lean();
    let zoneDetails = null;
    
    // We search through all cities to find the matching zone name
    for (const cz of cityZones) {
      const match = cz.zones?.find(z => z.name === partner.zone);
      if (match) {
        zoneDetails = match;
        break;
      }
    }

    // Get today's subscriptions for this zone
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's tiffin stops for this zone from real DB
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const occurrences = await SubscriptionOccurrence.find({
      scheduledDate: { $gte: todayStart, $lt: todayEnd },
      status: { $in: ['SCHEDULED', 'PROCESSING', 'ORDER_CREATED'] }
    })
      .populate({
        path: 'subscriptionId',
        match: { 'deliveryAddress.zone': partner.zone },
        populate: { path: 'customerId', select: 'fullName mobile' }
      })
      .lean();

    const routeStops = occurrences
      .filter(o => o.subscriptionId)
      .map((o, index) => {
        const sub = o.subscriptionId;
        return {
          stopId: o._id,
          stopNumber: index + 1,
          timeSlot: sub.planSnapshot?.mealType === 'DINNER' ? '7:00 PM - 8:00 PM' : '12:00 PM - 1:00 PM',
          mealType: sub.planSnapshot?.mealType || 'LUNCH',
          tiffinsCount: sub.planSnapshot?.items?.length || 1,
          customerName: sub.customerId?.fullName || sub.deliveryAddress?.name || 'Customer',
          address: sub.deliveryAddress?.addressLine1 || '',
          latitude: sub.deliveryAddress?.latitude || null,
          longitude: sub.deliveryAddress?.longitude || null,
          isCompleted: o.status === 'ORDER_CREATED'
        };
      });

    const completedRuns = routeStops.filter(s => s.isCompleted).length;

    return successResponse(res, {
      data: {
        zoneName: partner.zone,
        zoneSubtitle: zoneDetails?.description || 'High-density tiffin delivery sector',
        radiusKm: zoneDetails?.radius || 10,
        subscribersCount,
        todayRuns: routeStops.length,
        completedRuns,
        routeStops
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get list of subscribers in partner's zone
 * @route GET /api/delivery/partner/zone/subscribers
 * @access Private (Delivery Partner)
 */
export const getZoneSubscribers = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const partner = await DeliveryPartner.findById(partnerId).lean();

    if (!partner || !partner.zone) {
      return errorResponse(res, { statusCode: 400, message: 'Partner not found or no zone assigned' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Query by zone in address or directly on subscription, using a fallback $or just in case
    const query = {
      $or: [
        { zone: partner.zone },
        { 'deliveryAddress.zone': partner.zone },
        { 'deliveryAddress.city': partner.city } // fallback if zone doesn't match
      ]
    };

    if (status) {
      query.status = status.toUpperCase();
    }

    const total = await Subscription.countDocuments(query);
    const subscriptions = await Subscription.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const subscribers = subscriptions.map((sub, index) => ({
      id: sub._id,
      name: sub.customerSnapshot?.name || sub.deliveryAddress?.name || `Subscriber ${index + 1}`,
      plan: sub.planSnapshot?.name || 'Tiffin Plan',
      address: sub.customerSnapshot?.addressLine1 || sub.deliveryAddress?.addressLine1 || '',
      subscriptionSince: sub.startDate || sub.createdAt,
      status: sub.status ? sub.status.toLowerCase() : 'active',
      isNew: new Date(sub.createdAt) > sevenDaysAgo,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.customerSnapshot?.name || 'Customer')}&background=random`
    }));

    return successResponse(res, {
      data: {
        subscribers,
        pagination: { page: pageNum, limit: limitNum, total }
      }
    });
  } catch (error) {
    next(error);
  }
};
