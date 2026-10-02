import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters'],
    default: ''
  },
  emoji: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByType'
  },
  createdByType: {
    type: String,
    enum: ['Admin', 'Restaurant'],
    default: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'updatedByType'
  },
  updatedByType: {
    type: String,
    enum: ['Admin', 'Restaurant'],
    default: 'Admin'
  }
}, { timestamps: true });

CategorySchema.index({ name: 1, restaurantId: 1 }, { unique: true });

export default mongoose.model('Category', CategorySchema);
