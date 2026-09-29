import Review from '../../models/reviews/Review.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getAllReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, restaurantId, comment } = req.query;

  const query = {};
  if (status) query.status = status;
  if (restaurantId) query.restaurantId = restaurantId;
  if (comment) query.comment = { $regex: comment, $options: 'i' };

  const reviews = await Review.find(query)
    .populate('customerId', 'name mobile')
    .populate('restaurantId', 'restaurantName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Review.countDocuments(query);

  return successResponse(res, {
    message: 'Reviews retrieved successfully',
    data: {
      reviews,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

export const hideReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    return errorResponse(res, { statusCode: 404, message: 'Review not found' });
  }

  review.status = 'HIDDEN';
  await review.save();

  return successResponse(res, {
    message: 'Review hidden successfully',
    data: { review }
  });
});

export const publishReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    return errorResponse(res, { statusCode: 404, message: 'Review not found' });
  }

  review.status = 'PUBLISHED';
  await review.save();

  return successResponse(res, {
    message: 'Review published successfully',
    data: { review }
  });
});

export const flagReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    return errorResponse(res, { statusCode: 404, message: 'Review not found' });
  }

  review.status = 'FLAGGED';
  await review.save();

  return successResponse(res, {
    message: 'Review flagged successfully',
    data: { review }
  });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    return errorResponse(res, { statusCode: 404, message: 'Review not found' });
  }

  await Review.findByIdAndDelete(req.params.id);

  return successResponse(res, {
    message: 'Review deleted successfully',
    data: {}
  });
});
