import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true
    },
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
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`
      }
    },
    password: {
      type: String
    },
    role: {
      type: String,
      default: 'Customer',
      enum: ['Customer']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isMobileVerified: {
      type: Boolean,
      default: false
    },
    lastLogin: {
      type: Date,
      default: null
    },
    avatar: {
      type: String,
      default: null
    },
    dietaryPreference: {
      type: String,
      enum: ['VEG', 'NON_VEG', 'BOTH'],
      default: 'BOTH'
    },
    fcmTokens: {
      type: [String],
      default: []
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletionReason: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Method to remove sensitive fields from JSON output
customerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('Customer', customerSchema);
