import mongoose from 'mongoose';

const deviceTokenSchema = new mongoose.Schema(
  {
    deliveryPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryPartner',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      trim: true
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: 'android'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

deviceTokenSchema.index({ deliveryPartnerId: 1, token: 1 }, { unique: true });

export default mongoose.models.DeviceToken || mongoose.model('DeviceToken', deviceTokenSchema);
