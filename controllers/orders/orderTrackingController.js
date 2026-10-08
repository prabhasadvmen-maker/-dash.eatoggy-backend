import mongoose from 'mongoose';
import Order from '../../models/orders/Order.js';
import Delivery from '../../models/delivery/Delivery.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { getRoute } from '../../integrations/maps/geoapifyService.js';

/**
 * @desc  Live order tracking for customer
 * @route GET /api/customers/orders/tracking/:id
 * @access Private (Customer)
 */
export const getOrderTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer?.id || req.user?.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, { statusCode: 400, message: 'Invalid order ID' });
  }

  // Fetch order
  const order = await Order.findById(id).lean();
  if (!order) return errorResponse(res, { statusCode: 404, message: 'Order not found' });

  if (order.customerId.toString() !== customerId.toString()) {
    return errorResponse(res, { statusCode: 403, message: 'Not authorized' });
  }

  // Fetch delivery record
  const delivery = await Delivery.findOne({ orderId: id }).lean();

  let partnerInfo = null;
  let partnerLat = null;
  let partnerLon = null;
  let routeData = null;

  if (delivery?.deliveryPartnerId) {
    const partner = await DeliveryPartner.findById(delivery.deliveryPartnerId)
      .select('fullName mobile averageRating currentLocation')
      .lean();

    if (partner) {
      partnerLat = partner.currentLocation?.latitude || null;
      partnerLon = partner.currentLocation?.longitude || null;

      partnerInfo = {
        name: partner.fullName || 'Delivery Partner',
        phone: partner.mobile || '',
        rating: partner.averageRating || 0,
        currentLocation: partnerLat && partnerLon
          ? { lat: partnerLat, lng: partnerLon }
          : null
      };
    }
  }

  // Destination coords from delivery snapshot or order address
  const destLat = delivery?.customerSnapshot?.latitude || null;
  const destLon = delivery?.customerSnapshot?.longitude || null;

  // Get real route + ETA from Geoapify if we have both coords
  if (partnerLat && partnerLon && destLat && destLon) {
    routeData = await getRoute(partnerLat, partnerLon, destLat, destLon);
  }

  const etaMinutes = routeData?.durationMinutes || 30;
  const distanceKm = routeData?.distanceKm || null;

  return successResponse(res, {
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.orderStatus,
      eta: `${etaMinutes}-${etaMinutes + 5} mins`,
      etaMinutes,
      distanceKm,
      deliveryPartner: partnerInfo,
      destination: destLat && destLon ? { lat: destLat, lng: destLon } : null,
      route: routeData
        ? {
            distanceKm: routeData.distanceKm,
            durationMinutes: routeData.durationMinutes,
            steps: routeData.steps,
            polyline: routeData.polyline
          }
        : null
    }
  });
});
