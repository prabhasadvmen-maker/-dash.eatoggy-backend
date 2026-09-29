import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    image: {
      type: String,
      default: ''
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    itemSubtotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true,
      index: true
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null
    },
    items: {
      type: [cartItemSchema],
      default: []
    },
    couponCode: {
      type: String,
      default: null
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    pricing: {
      subtotal: {
        type: Number,
        default: 0,
        min: 0
      },
      packagingCharge: {
        type: Number,
        default: 0,
        min: 0
      },
      platformFee: {
        type: Number,
        default: 0,
        min: 0
      },
      deliveryFee: {
        type: Number,
        default: 0,
        min: 0
      },
      gst: {
        type: Number,
        default: 0,
        min: 0
      },
      grandTotal: {
        type: Number,
        default: 0,
        min: 0
      }
    }
  },
  { timestamps: true }
);


export default mongoose.model('Cart', cartSchema);
