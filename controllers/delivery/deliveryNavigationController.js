import mongoose from 'mongoose';
import Delivery from '../../models/delivery/Delivery.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { getRoute } from '../../integrations/maps/geoapifyService.js';

const getPartnerId = (req) => {
  const raw = req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
  if (!raw) return null;
  try { return new mongoose.Types.ObjectId(raw.toString()); } catch { return null; }
};

/**
 * @desc Get turn-by-turn navigation data for active delivery
 * @route GET /api/delivery/orders/:orderId/navigation
 * @access Private (Delivery Partner)
 */
export const getNavigationData = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { orderId } = req.params;

    const delivery = await Delivery.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }],
      deliveryPartnerId: partnerId
    }).lean();

    if (!delivery) {
      return errorResponse(res, { statusCode: 404, message: 'Delivery not found or not assigned to you' });
    }

    const partner = await DeliveryPartner.findById(partnerId).select('currentLocation').lean();

    const partnerLat = partner?.currentLocation?.latitude || null;
    const partnerLon = partner?.currentLocation?.longitude || null;

    if (!partnerLat || !partnerLon) {
      return errorResponse(res, { statusCode: 422, message: 'Partner GPS location not available. Please enable location.' });
    }

    let destLat, destLon, destTitle, destAddress, destDetails;

    if (['ASSIGNED', 'ACCEPTED'].includes(delivery.deliveryStatus)) {
      destLat = delivery.restaurantSnapshot?.latitude || partnerLat;
      destLon = delivery.restaurantSnapshot?.longitude || partnerLon;
      destTitle = delivery.restaurantSnapshot?.name || 'Restaurant';
      destAddress = delivery.restaurantSnapshot?.address || '';
      destDetails = 'Pickup Location';
    } else {
      destLat = delivery.customerSnapshot?.latitude || partnerLat;
      destLon = delivery.customerSnapshot?.longitude || partnerLon;
      destTitle = delivery.customerSnapshot?.name || 'Customer';
      destAddress = delivery.customerSnapshot?.addressLine1 || '';
      destDetails = delivery.customerSnapshot?.addressLine2 || '';
    }

    // Real route from Geoapify
    const routeData = await getRoute(partnerLat, partnerLon, destLat, destLon);

    return successResponse(res, {
      data: {
        orderId: delivery.orderNumber || delivery._id,
        etaMinutes: routeData.durationMinutes,
        distanceKm: routeData.distanceKm,
        destinationTitle: destTitle,
        destinationDetails: destDetails,
        destinationAddress: destAddress,
        latitude: destLat,
        longitude: destLon,
        route: {
          distanceKm: routeData.distanceKm,
          durationMinutes: routeData.durationMinutes,
          steps: routeData.steps,
          polyline: routeData.polyline
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update partner's live GPS location
 * @route PUT /api/delivery/partner/location
 * @access Private (Delivery Partner)
 */
export const updateLocation = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { latitude, longitude, orderId } = req.body;

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid coordinates' });
    }

    // Fast write, no transaction needed
    await DeliveryPartner.findByIdAndUpdate(partnerId, {
      currentLocation: {
        latitude,
        longitude,
        updatedAt: new Date()
      }
    });

    if (orderId) {
      // Also update delivery partnerLocation if schema supports it (here mapped to currentLocation)
      await Delivery.findOneAndUpdate(
        { $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderNumber: orderId }] },
        { 'currentLocation.latitude': latitude, 'currentLocation.longitude': longitude, 'currentLocation.updatedAt': new Date() }
      );
    }

    // Broadcast to websocket
    if (req.io) {
      req.io.emit('partner:location_update', {
        partnerId,
        orderId,
        latitude,
        longitude,
        timestamp: new Date()
      });
    }

    return successResponse(res, { message: 'Location updated' });
  } catch (error) {
    next(error);
  }
};
