import {
  createOrderReview,
  getRestaurantReviewsService,
  getCustomerReviewsService,
  addRestaurantReplyService,
  getAllReviewsForAdmin,
  updateReviewStatusService
} from '../../services/reviews/reviewService.js';

/**
 * Customer: Submit review for order
 */
export const postReview = async (req, res) => {
  try {
    const customerId = req.customer?.id || req.customer?._id || req.user?.id || req.user?._id;
    const { orderId } = req.params;
    const { rating, foodRating, deliveryRating, comment, images } = req.body;

    if (!rating) {
      return res.status(400).json({ success: false, message: 'Rating is required' });
    }

    const review = await createOrderReview({
      orderId,
      customerId,
      rating: Number(rating),
      foodRating: foodRating ? Number(foodRating) : Number(rating),
      deliveryRating: deliveryRating ? Number(deliveryRating) : Number(rating),
      comment,
      images
    });

    res.status(201).json({ success: true, message: 'Review submitted successfully', data: review });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Customer: Get my reviews
 */
export const getMyCustomerReviews = async (req, res) => {
  try {
    const customerId = req.customer?.id || req.customer?._id || req.user?.id || req.user?._id;
    const reviews = await getCustomerReviewsService(customerId);
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Restaurant: Get reviews for my restaurant
 */
export const getMyRestaurantReviews = async (req, res) => {
  try {
    const restaurantId = req.restaurant?.id || req.restaurant?._id || req.restaurantId || req.user?.id || req.user?._id;
    const data = await getRestaurantReviewsService(restaurantId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Restaurant: Reply to a review
 */
export const postRestaurantReply = async (req, res) => {
  try {
    const restaurantId = req.restaurant?.id || req.restaurant?._id || req.restaurantId || req.user?.id || req.user?._id;
    const { id: reviewId } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ success: false, message: 'Reply comment is required' });
    }

    const review = await addRestaurantReplyService(reviewId, restaurantId, comment);
    res.json({ success: true, message: 'Reply posted successfully', data: review });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: List all reviews across platform
 */
export const getAdminReviews = async (req, res) => {
  try {
    const { status } = req.query;
    const reviews = await getAllReviewsForAdmin({ status });
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Moderate review status (PUBLISHED, HIDDEN, FLAGGED)
 */
export const patchReviewStatus = async (req, res) => {
  try {
    const { id: reviewId } = req.params;
    const { status } = req.body;

    if (!['PUBLISHED', 'HIDDEN', 'FLAGGED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const review = await updateReviewStatusService(reviewId, status);
    res.json({ success: true, message: 'Review status updated', data: review });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
