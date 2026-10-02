import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema({
  url: { type: String },
  originalName: { type: String },
  mimeType: { type: String },
  size: { type: Number },
  uploadedAt: { type: Date }
}, { _id: false });

const RestaurantSchema = new mongoose.Schema({
  // Owner Details
  ownerName: { type: String },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, sparse: true },
  password: { type: String },
  
  // Restaurant Details
  restaurantName: { type: String },
  restaurantType: { type: String }, // e.g., Cafe, Cloud Kitchen, Fine Dining
  cuisine: { type: String }, // e.g., North Indian, Chinese, Italian
  fullAddress: { type: String },
  city: { type: String },
  pincode: { type: String },
  operatingHours: {
    open: { type: String },
    close: { type: String }
  },

  // Document Links (R2 URLs)
  documents: {
    panCard: { type: String },
    businessRegistration: { type: String },
    foodLicense: { type: String },
    gstCertificate: { type: String },
    idProof: { type: String },
    aadhaarFront: { type: String },
    aadhaarBack: { type: String },
    restaurantImage: { type: String },
    menu: { type: String },
    kitchenVideo: { type: String }
  },

  // Kitchen Hygiene Proof
  kitchenHygieneProof: {
    mainPrepStation: FileSchema,
    additionalAreas: {
      storageAndFridge: FileSchema,
      dishwashingArea: FileSchema
    },
    completed: { type: Boolean, default: false },
    submittedAt: { type: Date }
  },

  // Bank Details
  bankDetails: {
    accountHolderName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    upiId: { type: String }
  },

  // Flow State & Onboarding Progress
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
    default: 'PENDING'
  },
  onboardingStatus: {
    type: String,
    enum: ['DRAFT', 'ONBOARDING_IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'],
    default: 'DRAFT'
  },
  currentStep: {
    type: String,
    enum: ['WELCOME', 'BUSINESS_DETAILS', 'KITCHEN_HYGIENE', 'BUSINESS_DOCS', 'IDENTITY_BANK', 'REVIEW_PAYMENT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'],
    default: 'WELCOME'
  },
  rejectionReason: { type: String, default: '' },
  suspensionReason: { type: String, default: '' },
  
  // Security
  isPhoneVerified: { type: Boolean, default: false },
  paymentId: { type: String, default: null },
  lastLogin: { type: Date },

  // Device & Push Notifications
  fcmToken: { type: String },
  devicePlatform: { type: String, enum: ['ANDROID', 'IOS', 'WEB'] },
  appVersion: { type: String }

}, { timestamps: true });

// Compound Index for fast lookup by status and onboardingStatus
RestaurantSchema.index({ status: 1, onboardingStatus: 1 });

export default mongoose.model('Restaurant', RestaurantSchema);
