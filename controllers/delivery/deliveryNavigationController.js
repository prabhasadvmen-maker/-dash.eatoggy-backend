import Delivery from '../../models/delivery/Delivery.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

const getPartnerId = (req) => {
  return req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
};

// Haversine formula to calculate distance in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
    
    // Default fallback to center of Delhi if not available
    const partnerLat = partner?.currentLocation?.latitude || 28.6139;
    const partnerLon = partner?.currentLocation?.longitude || 77.2090;

    let destLat, destLon, destTitle, destAddress, destDetails;

    // Depending on deliveryStatus, navigate to Restaurant or Customer
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

    // Rough distance in Km
    const distanceKm = calculateDistance(partnerLat, partnerLon, destLat, destLon);
    
    // Rough ETA: assume avg 20km/h in city = ~3 min per km
    const etaMinutes = Math.max(1, Math.round(distanceKm * 3));

    return successResponse(res, {
      data: {
        orderId: delivery.orderNumber || delivery._id,
        etaMinutes,
        distanceKm: Number(distanceKm.toFixed(1)),
        turnDirection: 'Follow the highlighted route on the map', // Mocked direction
        destinationTitle: destTitle,
        destinationDetails: destDetails,
        destinationAddress: destAddress,
        latitude: destLat,
        longitude: destLon
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
