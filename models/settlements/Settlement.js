import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema(
  {
    settlementNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    entityType: {
      type: String,
      enum: ['RESTAURANT', 'DELIVERY_PARTNER'],
      required: true,
      index: true
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
      index: true
    },
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      default: null,
      index: true
    },
    periodStart: {
      type: Date,
      required: true
    },
    periodEnd: {
      type: Date,
      required: true
    },
    orderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
      }
    ],
    subscriptionOccurrenceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionOccurrence'
      }
    ],
    totalOrdersCount: {
      type: Number,
      required: true,
      default: 0
    },
    grossEarnings: {
      type: Number,
      required: true,
      default: 0
    },
    platformCommissionRate: {
      type: Number,
      default: 15 // 15%
    },
    platformCommissionDeduction: {
      type: Number,
      default: 0
    },
    taxDeduction: {
      type: Number,
      default: 0
    },
    refundDeduction: {
      type: Number,
      default: 0
    },
    otherDeductions: {
      type: Number,
      default: 0
    },
    netPayoutAmount: {
      type: Number,
      required: true,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    transactionReference: {
      type: String,
      default: ''
    },
    failureReason: {
      type: String,
      default: ''
    },
    processedAt: {
      type: Date,
      default: null
    },
    paidAt: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

// Compound unique index guaranteeing database-level idempotency across concurrent workers
settlementSchema.index(
  { entityType: 1, restaurantId: 1, deliveryPartnerId: 1, periodStart: 1, periodEnd: 1 },
  { unique: true }
);

export default mongoose.model('Settlement', settlementSchema);
