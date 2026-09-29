import { asyncHandler } from '../../common/asyncHandler.js';
import { successResponse } from '../../common/apiResponse.js';

export const getAppConfig = asyncHandler(async (req, res) => {
  return successResponse(res, {
    data: {
      razorpayKey: process.env.RAZORPAY_KEY_ID || 'rzp_live_abc123xyz',
      mapsApiKey: process.env.MAPS_API_KEY || 'AIzaSyD-sample-maps-key',
      mapProvider: 'google',
      supportPhoneNumber: '+918830448351',
      supportEmail: 'care@eatoggy.in',
      minAppVersion: '1.0.0',
      forceUpdate: false
    }
  });
});
