import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import Notification from '../../models/notifications/Notification.js';
import Restaurant from '../../models/restaurants/Restaurant.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  const { page = 1, limit = 20, status } = req.query;
  const query = { restaurantId };

  if (status === 'READ') query.isRead = true;
  if (status === 'UNREAD') query.isRead = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitVal = parseInt(limit);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitVal),
    Notification.countDocuments(query),
    Notification.countDocuments({ restaurantId, isRead: false })
  ]);

  return successResponse(res, {
    statusCode: 200,
    message: 'Notifications retrieved successfully',
    data: {
      unreadCount,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: limitVal,
        total,
        totalPages: Math.ceil(total / limitVal)
      }
    }
  });
});

export const registerDeviceToken = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  const { fcmToken, devicePlatform, appVersion } = req.body;

  if (!fcmToken || fcmToken.trim().length === 0) {
    return errorResponse(res, { statusCode: 400, message: 'FCM token is required' });
  }

  const allowedPlatforms = ['ANDROID', 'IOS', 'WEB'];
  if (devicePlatform && !allowedPlatforms.includes(devicePlatform.toUpperCase())) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid device platform' });
  }

  await Restaurant.findByIdAndUpdate(restaurantId, {
    fcmToken: fcmToken.trim(),
    devicePlatform: devicePlatform ? devicePlatform.toUpperCase() : undefined,
    appVersion: appVersion || undefined
  });

  return successResponse(res, {
    statusCode: 200,
    message: 'FCM device token registered successfully'
  });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant?.id || req.user?.id;
  if (!restaurantId) {
    return errorResponse(res, { statusCode: 401, message: 'Unauthorized restaurant access' });
  }

  const { notificationIds } = req.body;
  const query = { restaurantId, isRead: false };

  if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
    query._id = { $in: notificationIds };
  }

  const updateResult = await Notification.updateMany(query, {
    $set: { isRead: true, readAt: new Date() }
  });

  const unreadCount = await Notification.countDocuments({ restaurantId, isRead: false });

  return successResponse(res, {
    statusCode: 200,
    message: 'Notifications marked as read successfully',
    data: {
      markedCount: updateResult.modifiedCount,
      unreadCount
    }
  });
});
