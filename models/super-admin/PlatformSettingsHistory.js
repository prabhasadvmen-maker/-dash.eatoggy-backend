import mongoose from 'mongoose';

const platformSettingsHistorySchema = new mongoose.Schema(
  {
    settingKey: {
      type: String,
      required: true,
      index: true
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    changedByEmail: {
      type: String,
      default: 'superadmin@eatoggy.com'
    }
  },
  {
    timestamps: true
  }
);

platformSettingsHistorySchema.index({ createdAt: -1 });

const PlatformSettingsHistory =
  mongoose.models.PlatformSettingsHistory ||
  mongoose.model('PlatformSettingsHistory', platformSettingsHistorySchema);

export default PlatformSettingsHistory;
