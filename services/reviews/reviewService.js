import Review from '../../models/reviews/Review.js';
import Order from '../../models/orders/Order.js';

/**
 * Submit a customer review for an order
 */
export const createOrderReview = async ({ orderId, customerId, rating, foodRating, deliveryRating, comment, images }) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Ensure order belongs to customer
  const custOwner = order.customerId || order.customer;
  if (!custOwner || custOwner.toString() !== customerId.toString()) {
    throw new Error('Unauthorized to review this order');
  }

  // Ensure order is delivered
  if (order.orderStatus !== 'DELIVERED') {
    throw new Error('Only delivered orders can be reviewed');
  }

  // Check if review already exists
  const existingReview = await Review.findOne({ orderId });
  if (existingReview) {
    throw new Error('Review already submitted for this order');
  }

  const restaurantId = order.restaurantId || order.restaurant;
  const deliveryPartnerId = order.deliveryPartner || order.deliveryDetails?.assignedPartner || null;

  const review = await Review.create({
    orderId,
    customerId,
    restaurantId,
    deliveryPartnerId,
    rating,
    foodRating: foodRating || rating,
    deliveryRating: deliveryRating || rating,
    comment,
    images: images || [],
    status: 'PUBLISHED'
  });

  return review;
};

/**
 * Get reviews for a restaurant with average rating summary
 */
export const getRestaurantReviewsService = async (restaurantId) => {
  const reviews = await Review.find({ restaurantId, status: 'PUBLISHED' })
    .populate('customerId', 'fullName name')
    .sort({ createdAt: -1 })
    .lean();

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
    : 0;

  const avgFoodRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + (r.foodRating || r.rating), 0) / totalReviews).toFixed(1)
    : 0;

  const avgDeliveryRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + (r.deliveryRating || r.rating), 0) / totalReviews).toFixed(1)
    : 0;

  return {
    reviews,
    avgRating: Number(avgRating),
    avgFoodRating: Number(avgFoodRating),
    avgDeliveryRating: Number(avgDeliveryRating),
    totalReviews
  };
};

/**
 * Get customer's submitted reviews
 */
export const getCustomerReviewsService = async (customerId) => {
  return await Review.find({ customerId })
    .populate('restaurantId', 'name')
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Restaurant reply to review
 */
export const addRestaurantReplyService = async (reviewId, restaurantId, replyComment) => {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new Error('Review not found');
  }

  if (review.restaurantId.toString() !== restaurantId.toString()) {
    throw new Error('Unauthorized to reply to this review');
  }

  review.reply = {
    comment: replyComment,
    createdAt: new Date()
  };

  await review.save();
  return review;
};

/**
 * SuperAdmin list all reviews
 */
export const getAllReviewsForAdmin = async ({ status }) => {
  const filter = {};
  if (status) filter.status = status;

  return await Review.find(filter)
    .populate('customerId', 'fullName name mobile')
    .populate('restaurantId', 'name')
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * SuperAdmin update review status (PUBLISHED, HIDDEN, FLAGGED)
 */
export const updateReviewStatusService = async (reviewId, status) => {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new Error('Review not found');
  }

  review.status = status;
  await review.save();
  return review;
};
