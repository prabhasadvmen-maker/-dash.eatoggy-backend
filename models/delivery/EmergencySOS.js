import mongoose from 'mongoose';

const emergencySOSSchema = new mongoose.Schema(
  {
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      required: true,
      index: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    sosType: {
      type: String,
      enum: ['ACCIDENT', 'THEFT', 'MEDICAL', 'HARASSMENT', 'OTHER'],
      required: true
    },
    message: {
      type: String,
      default: ''
    },
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'],
      default: 'ACTIVE',
      index: true
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

emergencySOSSchema.index({ deliveryPartnerId: 1, status: 1 });

export default mongoose.models.EmergencySOS || mongoose.model('EmergencySOS', emergencySOSSchema);
