import mongoose from 'mongoose';

const snapshotAddressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: '' },
    city: { type: String, required: true },
    pincode: { type: String, required: true },
    latitude: { type: Number, default: 28.6139 },
    longitude: { type: Number, default: 77.2090 }
  },
  { _id: false }
);

const snapshotRestaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    mobile: { type: String, default: '' },
    latitude: { type: Number, default: 28.6139 },
    longitude: { type: Number, default: 77.2090 }
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true
    },
    orderNumber: {
      type: String,
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
    assignmentStatus: {
      type: String,
      enum: ['UNASSIGNED', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'COMPLETED'],
      default: 'UNASSIGNED',
      index: true
    },
    deliveryStatus: {
      type: String,
      enum: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'],
      default: 'ASSIGNED',
      index: true
    },
    deliveryOtp: {
      type: String,
      required: true
    },
    isOtpVerified: {
      type: Boolean,
      default: false
    },
    timeSlot: {
      type: String,
      default: 'ASAP',
      enum: ['ASAP', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']
    },
    partnerLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      updatedAt: { type: Date, default: null }
    },
    restaurantSnapshot: {
      type: snapshotRestaurantSchema,
      required: true
    },
    customerSnapshot: {
      type: snapshotAddressSchema,
      required: true
    },
    pricingSnapshot: {
      grandTotal: { type: Number, required: true },
      deliveryFee: { type: Number, required: true, default: 35 }
    },
    currentLocation: {
      latitude: { type: Number, default: 28.6139 },
      longitude: { type: Number, default: 77.2090 },
      updatedAt: { type: Date, default: Date.now }
    },
    assignedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    outForDeliveryAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model('Delivery', deliverySchema);
