import { asyncHandler } from '../../common/asyncHandler.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

export const checkServiceability = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  
  if (!lat || !lng) {
    return errorResponse(res, { statusCode: 400, message: 'Latitude and longitude are required' });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  // In a real application, you would query a DeliveryZone or Zone model using 
  // MongoDB $geoIntersects or $near.
  // const Zone = (await import('../../models/super-admin/Zone.js')).default;
  // const zone = await Zone.findOne({
  //   polygon: {
  //     $geoIntersects: {
  //       $geometry: {
  //         type: "Point",
  //         coordinates: [lngNum, latNum]
  //       }
  //     }
  //   }
  // });

  // if (!zone) {
  //   return successResponse(res, { isServiceable: false });
  // }

  return successResponse(res, {
    data: {
      isServiceable: true,
      estimatedDeliveryMinutes: 35,
      kitchenId: 'kitchen_gurugram_01',
      deliveryFee: 30.0
    }
  });
});
