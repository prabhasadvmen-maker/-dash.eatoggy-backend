import Banner from '../../models/promotions/Banner.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';
import { getPresignedUrl } from '../../services/r2UploadService.js';

/**
 * @desc    Get active banners for customer
 * @route   GET /api/banners
 * @access  Public
 * @query   page, limit
 */
export const getBanners = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitVal = parseInt(limit);

  try {
    // Get all active banners (date filtering can be added later if needed)
    const [banners, total] = await Promise.all([
      Banner.find({ isActive: true })
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitVal),
      Banner.countDocuments({ isActive: true })
    ]);

    // Get presigned URLs for images
    const bannersWithUrls = await Promise.all(
      banners.map(async (banner) => {
        const bannerObj = banner.toObject();
        if (bannerObj.image) {
          try {
            bannerObj.image = await getPresignedUrl(bannerObj.image);
          } catch (err) {
            console.error('Error getting presigned URL:', err);
          }
        }
        return bannerObj;
      })
    );

    return successResponse(res, {
      statusCode: 200,
      message: 'Banners retrieved successfully',
      data: bannersWithUrls,
      pagination: {
        total,
        page: parseInt(page),
        limit: limitVal,
        totalPages: Math.ceil(total / limitVal)
      }
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    return errorResponse(res, {
      statusCode: 500,
      message: 'Failed to fetch banners'
    });
  }
});
