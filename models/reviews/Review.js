import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true
    },
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      default: null,
      index: true
    },
    subscriptionOccurrenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionOccurrence',
      default: null,
      index: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    foodRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5
    },
    deliveryRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5
    },
    comment: {
      type: String,
      trim: true,
      default: ''
    },
    images: [
      {
        type: String
      }
    ],
    reply: {
      comment: { type: String, trim: true },
      createdAt: { type: Date }
    },
    status: {
      type: String,
      enum: ['PUBLISHED', 'HIDDEN', 'FLAGGED'],
      default: 'PUBLISHED',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate reviews per order
reviewSchema.index({ orderId: 1, customerId: 1 }, { unique: true, sparse: true });

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

export default Review;
