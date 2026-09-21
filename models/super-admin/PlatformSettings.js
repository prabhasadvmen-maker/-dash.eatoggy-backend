import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    platformName: {
      type: String,
      default: 'EATOGGY'
    },
    supportEmail: {
      type: String,
      default: 'support@eatoggy.com'
    },
    supportPhone: {
      type: String,
      default: '+91 98765 43210'
    },
    defaultCommissionRate: {
      type: Number,
      default: 15
    },
    baseDeliveryFee: {
      type: Number,
      default: 40
    },
    surgeMultiplier: {
      type: Number,
      default: 1.0
    },
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    autoAssignDelivery: {
      type: Boolean,
      default: true
    },
    razorpayEnabled: {
      type: Boolean,
      default: true
    },
    codEnabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const PlatformSettings = mongoose.models.PlatformSettings || mongoose.model('PlatformSettings', platformSettingsSchema);

export default PlatformSettings;
