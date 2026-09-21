import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner'
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant'
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    checkoutSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CheckoutSession'
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription'
    },
    purpose: {
      type: String,
      default: 'DELIVERY_PARTNER_ONBOARDING',
      enum: ['DELIVERY_PARTNER_ONBOARDING', 'RESTAURANT_PARTNER_ONBOARDING', 'ORDER_PAYMENT', 'SUBSCRIPTION_PAYMENT']
    },
    amount: {
      type: Number,
      required: true
    },
    amountPaise: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true
    },
    razorpayPaymentId: {
      type: String,
      default: ''
    },
    razorpaySignature: {
      type: String,
      default: ''
    },
    signatureVerified: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      default: 'PENDING',
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED']
    },
    refundDetails: {
      refundedAt: Date,
      refundAmount: Number,
      reason: String,
      refundId: String
    }
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
