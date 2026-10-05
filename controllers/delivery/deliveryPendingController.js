import mongoose from 'mongoose';
import DeviceToken from '../../models/delivery/DeviceToken.js';
import EmergencySOS from '../../models/delivery/EmergencySOS.js';
import Subscription from '../../models/subscriptions/Subscription.js';
import SubscriptionOccurrence from '../../models/subscriptions/SubscriptionOccurrence.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

const getPartnerId = (req) => {
  const raw = req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
  if (!raw) return null;
  try {
    return new mongoose.Types.ObjectId(raw.toString());
  } catch {
    return null;
  }
};

// ======================= 1. DEVICE TOKEN =======================

/**
 * @desc Save or update FCM device token
 * @route POST /api/delivery/device-token
 * @access Private (Delivery Partner)
 */
export const saveDeviceToken = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const { token, platform = 'android' } = req.body;
    if (!token) return errorResponse(res, { statusCode: 400, message: 'token is required' });

    const validPlatforms = ['android', 'ios', 'web'];
    if (!validPlatforms.includes(platform)) {
      return errorResponse(res, { statusCode: 400, message: `Invalid platform. Allowed: ${validPlatforms.join(', ')}` });
    }

    // Deactivate old tokens for this partner
    await DeviceToken.updateMany({ deliveryPartnerId: partnerId }, { isActive: false });

    // Upsert new token
    await DeviceToken.findOneAndUpdate(
      { deliveryPartnerId: partnerId, token },
      { deliveryPartnerId: partnerId, token, platform, isActive: true },
      { upsert: true, new: true }
    );

    return successResponse(res, {
      statusCode: 201,
      message: 'Device token saved successfully',
      data: { token, platform, isActive: true }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get all device tokens for partner
 * @route GET /api/delivery/device-token
 * @access Private (Delivery Partner)
 */
export const getDeviceTokens = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const tokens = await DeviceToken.find({ deliveryPartnerId: partnerId }).lean();

    return successResponse(res, { data: { tokens } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete a device token
 * @route DELETE /api/delivery/device-token
 * @access Private (Delivery Partner)
 */
export const deleteDeviceToken = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const { token } = req.body;
    if (!token) return errorResponse(res, { statusCode: 400, message: 'token is required' });

    const deleted = await DeviceToken.findOneAndDelete({ deliveryPartnerId: partnerId, token });
    if (!deleted) return errorResponse(res, { statusCode: 404, message: 'Token not found' });

    return successResponse(res, { message: 'Device token removed successfully' });
  } catch (error) {
    next(error);
  }
};

// ======================= 2. TIFFIN ROUTES =======================

/**
 * @desc Get today's tiffin batch routes and stops for delivery partner
 * @route GET /api/delivery/tiffin/routes/today
 * @access Private (Delivery Partner)
 */
export const getTodayTiffinRoutes = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayDay = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];

    // Get active subscriptions scheduled for today
    const activeSubscriptions = await Subscription.find({
      status: 'ACTIVE',
      scheduleDays: todayDay,
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart }
    })
      .populate('customerId', 'fullName mobile')
      .populate('restaurantId', 'name address latitude longitude')
      .lean();

    // Get today's occurrences
    const occurrences = await SubscriptionOccurrence.find({
      scheduledDate: { $gte: todayStart, $lt: todayEnd },
      status: { $in: ['SCHEDULED', 'PROCESSING', 'ORDER_CREATED'] }
    }).lean();

    const occurrenceMap = {};
    occurrences.forEach(o => { occurrenceMap[o.subscriptionId.toString()] = o; });

    const stops = activeSubscriptions.map((sub, index) => {
      const occurrence = occurrenceMap[sub._id.toString()];
      return {
        stopId: occurrence?._id || sub._id,
        stopNumber: index + 1,
        subscriptionId: sub._id,
        customerName: sub.customerId?.fullName || sub.deliveryAddress?.name || 'Customer',
        customerMobile: sub.customerId?.mobile || sub.deliveryAddress?.mobile || '',
        deliveryAddress: sub.deliveryAddress?.addressLine1 || '',
        city: sub.deliveryAddress?.city || '',
        pincode: sub.deliveryAddress?.pincode || '',
        mealType: sub.planSnapshot?.mealType || 'LUNCH',
        planName: sub.planSnapshot?.name || '',
        items: sub.planSnapshot?.items || [],
        status: occurrence?.status || 'SCHEDULED',
        isCompleted: occurrence?.status === 'ORDER_CREATED'
      };
    });

    const completedCount = stops.filter(s => s.isCompleted).length;

    return successResponse(res, {
      data: {
        date: todayStart.toISOString().split('T')[0],
        day: todayDay,
        totalStops: stops.length,
        completedStops: completedCount,
        pendingStops: stops.length - completedCount,
        stops
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Mark a tiffin stop as delivered
 * @route POST /api/delivery/tiffin/stops/:stopId/complete
 * @access Private (Delivery Partner)
 */
export const completeTiffinStop = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const { stopId } = req.params;
    const { otp, notes, latitude, longitude } = req.body;

    if (!mongoose.Types.ObjectId.isValid(stopId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid stopId' });
    }

    const occurrence = await SubscriptionOccurrence.findById(stopId);
    if (!occurrence) {
      return errorResponse(res, { statusCode: 404, message: 'Tiffin stop not found' });
    }

    if (occurrence.status === 'ORDER_CREATED') {
      return errorResponse(res, { statusCode: 422, message: 'This stop is already marked as delivered' });
    }

    occurrence.status = 'ORDER_CREATED';
    occurrence.generatedAt = new Date();
    if (notes) occurrence.lastProcessingError = null;
    await occurrence.save();

    // Update partner delivery count
    await DeliveryPartner.findByIdAndUpdate(partnerId, {
      $inc: { totalDeliveries: 1 }
    });

    return successResponse(res, {
      message: 'Tiffin stop marked as delivered',
      data: {
        stopId: occurrence._id,
        subscriptionId: occurrence.subscriptionId,
        status: 'ORDER_CREATED',
        completedAt: occurrence.generatedAt,
        notes: notes || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get a single tiffin stop detail
 * @route GET /api/delivery/tiffin/stops/:stopId
 * @access Private (Delivery Partner)
 */
export const getTiffinStopDetail = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const { stopId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(stopId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid stopId' });
    }

    const occurrence = await SubscriptionOccurrence.findById(stopId)
      .populate({
        path: 'subscriptionId',
        populate: [
          { path: 'customerId', select: 'fullName mobile' },
          { path: 'restaurantId', select: 'name address latitude longitude' }
        ]
      })
      .lean();

    if (!occurrence) return errorResponse(res, { statusCode: 404, message: 'Tiffin stop not found' });

    const sub = occurrence.subscriptionId;

    return successResponse(res, {
      data: {
        stopId: occurrence._id,
        status: occurrence.status,
        scheduledDate: occurrence.scheduledDate,
        customerName: sub?.customerId?.fullName || sub?.deliveryAddress?.name || 'Customer',
        customerMobile: sub?.customerId?.mobile || sub?.deliveryAddress?.mobile || '',
        deliveryAddress: sub?.deliveryAddress || {},
        restaurantName: sub?.restaurantId?.name || '',
        planName: sub?.planSnapshot?.name || '',
        mealType: sub?.planSnapshot?.mealType || '',
        items: sub?.planSnapshot?.items || [],
        isCompleted: occurrence.status === 'ORDER_CREATED'
      }
    });
  } catch (error) {
    next(error);
  }
};

// ======================= 3. EMERGENCY SOS =======================

/**
 * @desc Trigger emergency SOS alert
 * @route POST /api/delivery/emergency/sos
 * @access Private (Delivery Partner)
 */
export const triggerSOS = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const { sosType, message, latitude, longitude, orderId } = req.body;

    const validTypes = ['ACCIDENT', 'THEFT', 'MEDICAL', 'HARASSMENT', 'OTHER'];
    if (!sosType || !validTypes.includes(sosType)) {
      return errorResponse(res, { statusCode: 400, message: `sosType is required. Allowed: ${validTypes.join(', ')}` });
    }

    const sos = await EmergencySOS.create({
      deliveryPartnerId: partnerId,
      orderId: orderId && mongoose.Types.ObjectId.isValid(orderId) ? orderId : null,
      sosType,
      message: message || '',
      latitude: latitude || null,
      longitude: longitude || null,
      status: 'ACTIVE'
    });

    // Emit real-time SOS alert to admin
    if (req.io) {
      req.io.emit('emergency:sos', {
        sosId: sos._id,
        partnerId,
        sosType,
        latitude,
        longitude,
        message,
        triggeredAt: sos.createdAt
      });
    }

    return successResponse(res, {
      statusCode: 201,
      message: 'SOS alert triggered. Help is on the way.',
      data: {
        sosId: sos._id,
        sosType,
        status: 'ACTIVE',
        triggeredAt: sos.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get all SOS alerts for partner
 * @route GET /api/delivery/emergency/sos
 * @access Private (Delivery Partner)
 */
export const getSOSAlerts = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const alerts = await EmergencySOS.find({ deliveryPartnerId: partnerId })
      .sort({ createdAt: -1 })
      .lean();

    return successResponse(res, { data: { alerts } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update SOS status (resolve/acknowledge)
 * @route PATCH /api/delivery/emergency/sos/:sosId
 * @access Private (Delivery Partner)
 */
export const updateSOSStatus = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) return errorResponse(res, { statusCode: 401, message: 'Unauthorized' });

    const { sosId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sosId)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid sosId' });
    }

    const validStatuses = ['ACKNOWLEDGED', 'RESOLVED'];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse(res, { statusCode: 400, message: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const sos = await EmergencySOS.findOneAndUpdate(
      { _id: sosId, deliveryPartnerId: partnerId },
      { status, ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}) },
      { new: true }
    );

    if (!sos) return errorResponse(res, { statusCode: 404, message: 'SOS alert not found' });

    return successResponse(res, {
      message: `SOS marked as ${status.toLowerCase()}`,
      data: { sosId: sos._id, status: sos.status }
    });
  } catch (error) {
    next(error);
  }
};
