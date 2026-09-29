import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema(
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
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'INITIATED',
      index: true
    },
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    razorpayRefundId: {
      type: String,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model('Refund', refundSchema);
