import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { geocodeAddress, reverseGeocode, getRoute } from '../../integrations/maps/geoapifyService.js';

/**
 * @desc  Geocode address string to lat/lng
 * @route GET /api/maps/geocode?address=...
 * @access Public
 */
export const geocode = asyncHandler(async (req, res) => {
  const { address } = req.query;
  if (!address) return errorResponse(res, { statusCode: 400, message: 'address query param is required' });

  const result = await geocodeAddress(address);
  if (!result) return errorResponse(res, { statusCode: 404, message: 'Address not found' });

  return successResponse(res, { data: result });
});

/**
 * @desc  Reverse geocode lat/lng to address
 * @route GET /api/maps/reverse-geocode?lat=...&lng=...
 * @access Public
 */
export const reverseGeocodeHandler = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return errorResponse(res, { statusCode: 400, message: 'lat and lng are required' });

  const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));
  if (!result) return errorResponse(res, { statusCode: 404, message: 'Location not found' });

  return successResponse(res, { data: result });
});

/**
 * @desc  Get route between two coordinates
 * @route GET /api/maps/route?fromLat=&fromLng=&toLat=&toLng=&mode=drive
 * @access Public
 */
export const getRouteHandler = asyncHandler(async (req, res) => {
  const { fromLat, fromLng, toLat, toLng, mode = 'drive' } = req.query;

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return errorResponse(res, { statusCode: 400, message: 'fromLat, fromLng, toLat, toLng are required' });
  }

  const validModes = ['drive', 'walk', 'bicycle', 'motorcycle'];
  if (!validModes.includes(mode)) {
    return errorResponse(res, { statusCode: 400, message: `mode must be one of: ${validModes.join(', ')}` });
  }

  const result = await getRoute(
    parseFloat(fromLat), parseFloat(fromLng),
    parseFloat(toLat), parseFloat(toLng),
    mode
  );

  return successResponse(res, { data: result });
});
