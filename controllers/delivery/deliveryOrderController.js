import * as deliveryService from '../../services/delivery/deliveryService.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

const getPartnerId = (req) => {
  return req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
};

const getCustomerId = (req) => {
  return req.customer?.id || req.customer?._id || req.user?.id || req.user?._id;
};

/**
 * @desc Toggle Delivery Partner Online Status
 * @route PUT /api/delivery/availability
 * @access Private (Delivery Partner)
 */
export const toggleAvailability = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized delivery partner access' });
    }

    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return errorResponse(res, { statusCode: 400, message: 'isOnline must be a boolean' });
    }

    const partner = await deliveryService.toggleAvailability(partnerId, isOnline);

    return successResponse(res, {
      statusCode: 200,
      message: `Delivery partner is now ${isOnline ? 'online' : 'offline'}`,
      data: { isOnline: partner.isOnline }
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc Get available delivery jobs for delivery partner
 * @route GET /api/delivery/jobs/available
 * @access Private (Delivery Partner)
 */
export const getAvailableJobs = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized delivery partner access' });
    }

    const jobs = await deliveryService.getAvailableJobs(partnerId);

    return successResponse(res, {
      statusCode: 200,
      message: 'Available delivery jobs retrieved successfully',
      data: jobs
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc Get current active delivery job for delivery partner
 * @route GET /api/delivery/jobs/active
 * @access Private (Delivery Partner)
 */
export const getActiveJob = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized delivery partner access' });
    }

    const job = await deliveryService.getActiveJobForPartner(partnerId);

    return successResponse(res, {
      statusCode: 200,
      message: 'Active delivery job retrieved successfully',
      data: job
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc Accept Delivery Job (Atomic Race Protection)
 * @route POST /api/delivery/jobs/:id/accept
 * @access Private (Delivery Partner)
 */
export const acceptJob = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized delivery partner access' });
    }

    const { id } = req.params;
    const delivery = await deliveryService.acceptDeliveryJob(id, partnerId);

    return successResponse(res, {
      statusCode: 200,
      message: 'Delivery job accepted successfully',
      data: delivery
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc Update Delivery Status (PICKED_UP / OUT_FOR_DELIVERY)
 * @route PATCH /api/delivery/jobs/:id/status
 * @access Private (Delivery Partner)
 */
export const updateStatus = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized delivery partner access' });
    }

    const { id } = req.params;
    const { status } = req.body;

    const updatedDelivery = await deliveryService.updateDeliveryStatus(id, partnerId, status);

    return successResponse(res, {
      statusCode: 200,
      message: `Delivery status updated to ${status} successfully`,
      data: updatedDelivery
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc Update Live GPS Location
 * @route PATCH /api/delivery/jobs/:id/location
 * @access Private (Delivery Partner)
 */
export const updateLocation = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized delivery partner access' });
    }

    const { id } = req.params;
    const { latitude, longitude } = req.body;

    const updatedDelivery = await deliveryService.updateDeliveryLocation(id, partnerId, latitude, longitude);

    return successResponse(res, {
      statusCode: 200,
      message: 'Delivery GPS location updated successfully',
      data: updatedDelivery
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc Verify OTP and Complete Delivery
 * @route POST /api/delivery/jobs/:id/verify-otp
 * @access Private (Delivery Partner)
 */
export const verifyOtpAndComplete = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    if (!partnerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized delivery partner access' });
    }

    const { id } = req.params;
    const { otp } = req.body;

    const completedDelivery = await deliveryService.verifyOtpAndCompleteDelivery(id, partnerId, otp);

    return successResponse(res, {
      statusCode: 200,
      message: 'Delivery completed successfully with valid OTP',
      data: completedDelivery
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};

/**
 * @desc Get Live Order Tracking for Customer
 * @route GET /api/customers/orders/:id/tracking
 * @access Private (Customer)
 */
export const getCustomerOrderTracking = async (req, res, next) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return errorResponse(res, { statusCode: 401, message: 'Unauthorized customer access' });
    }

    const { id } = req.params;
    const trackingData = await deliveryService.getCustomerOrderTracking(customerId, id);

    return successResponse(res, {
      statusCode: 200,
      message: 'Customer order tracking retrieved successfully',
      data: trackingData
    });
  } catch (err) {
    if (err.statusCode) {
      return errorResponse(res, { statusCode: err.statusCode, message: err.message });
    }
    next(err);
  }
};
