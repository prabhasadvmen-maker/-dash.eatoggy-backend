import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  referenceId: { type: String },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Notification', NotificationSchema);
