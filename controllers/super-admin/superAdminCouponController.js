import Coupon from '../../models/super-admin/Coupon.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getCoupons = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const query = {};

  if (search) {
    query.$or = [
      { code: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } }
    ];
  }
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  
  const [coupons, total] = await Promise.all([
    Coupon.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(Number(limit)),
    Coupon.countDocuments(query)
  ]);

  return successResponse(res, {
    message: 'Coupons retrieved successfully',
    data: coupons,
    meta: {
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

export const createCoupon = asyncHandler(async (req, res) => {
  const { code, title, description, discountType, discountValue, minOrderValue, maxDiscountAmount, validFrom, validUntil, usageLimit } = req.body;

  if (!code || !title || !discountType || !discountValue || !validFrom || !validUntil) {
    return errorResponse(res, { statusCode: 400, message: 'Missing required fields' });
  }

  const existing = await Coupon.findOne({ code: code.toUpperCase() });
  if (existing) {
    return errorResponse(res, { statusCode: 400, message: 'Coupon code already exists' });
  }

  const coupon = await Coupon.create({
    code,
    title,
    description,
    discountType,
    discountValue,
    minOrderValue,
    maxDiscountAmount,
    validFrom,
    validUntil,
    usageLimit
  });

  return successResponse(res, { statusCode: 201, message: 'Coupon created successfully', data: coupon });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!coupon) {
    return errorResponse(res, { statusCode: 404, message: 'Coupon not found' });
  }
  return successResponse(res, { message: 'Coupon updated successfully', data: coupon });
});

export const toggleCouponStatus = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    return errorResponse(res, { statusCode: 404, message: 'Coupon not found' });
  }
  
  coupon.isActive = !coupon.isActive;
  await coupon.save();
  
  return successResponse(res, { message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`, data: coupon });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) {
    return errorResponse(res, { statusCode: 404, message: 'Coupon not found' });
  }
  return successResponse(res, { message: 'Coupon deleted successfully' });
});
