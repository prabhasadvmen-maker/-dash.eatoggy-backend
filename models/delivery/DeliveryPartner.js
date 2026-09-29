import mongoose from 'mongoose';

const deliveryPartnerSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[6-9]\d{9}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid 10-digit Indian mobile number!`
      }
    },
    fullName: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`
      }
    },
    city: {
      type: String,
      trim: true
    },
    zone: {
      type: String,
      trim: true
    },
    selectedAddress: {
      type: String,
      trim: true
    },
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    vehicleType: {
      type: String,
      enum: ['Bike', 'Scooter', 'EV Bike', 'Bicycle', 'Car'],
      default: 'Bike'
    },
    currentStep: {
      type: String,
      default: 'PROFILE',
      enum: [
        'PROFILE',
        'LOCATION',
        'DOCUMENTS',
        'BANK_DETAILS',
        'ONBOARDING_FEE',
        'PAYMENT',
        'PENDING_REVIEW',
        'APPROVED',
        'REJECTED'
      ]
    },
    role: {
      type: String,
      default: 'DeliveryPartner',
      enum: ['DeliveryPartner']
    },
    isActive: {
      type: Boolean,
      default: false
    },
    isOnline: {
      type: Boolean,
      default: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    currentLocation: {
      latitude: { type: Number, default: 28.6139 },
      longitude: { type: Number, default: 77.2090 },
      updatedAt: { type: Date, default: Date.now }
    },
    isMobileVerified: {
      type: Boolean,
      default: false
    },
    onboardingStatus: {
      type: String,
      default: 'ONBOARDING_IN_PROGRESS',
      enum: [
        'DRAFT',
        'OTP_VERIFIED',
        'ONBOARDING_IN_PROGRESS',
        'PENDING_PAYMENT',
        'PAYMENT_SUCCESS',
        'PENDING_REVIEW',
        'APPROVED',
        'REJECTED',
        'SUSPENDED'
      ]
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model('DeliveryPartner', deliveryPartnerSchema);
