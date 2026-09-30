import { asyncHandler } from '../../common/asyncHandler.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import Coupon from '../../models/super-admin/Coupon.js';

export const getOffers = asyncHandler(async (req, res) => {
  const offers = await Coupon.find({
    isActive: true,
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ]
  }).sort({ discountAmount: -1, discountPercent: -1 }).lean();

  return successResponse(res, {
    message: 'Offers retrieved successfully',
    data: offers.map(off => ({
      id: off._id,
      code: off.code,
      title: off.title,
      description: off.description,
      discountType: off.discountType,
      discountAmount: off.discountAmount,
      discountPercent: off.discountPercent,
      minOrderValue: off.minOrderValue,
      maxDiscount: off.maxDiscount,
      usageLimit: off.usageLimit,
      usageCount: off.usageCount,
      expiresAt: off.expiresAt,
      applicableOn: off.applicableOn
    }))
  });
});

export const applyCoupon = asyncHandler(async (req, res) => {
  const { couponCode } = req.body;
  if (!couponCode) {
    return errorResponse(res, { statusCode: 400, message: 'Coupon code is required' });
  }

  const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
  
  if (!coupon) {
    return errorResponse(res, { statusCode: 404, message: 'Coupon not found' });
  }

  if (!coupon.isActive) {
    return errorResponse(res, { statusCode: 400, message: 'Coupon is no longer active' });
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return errorResponse(res, { statusCode: 400, message: 'Coupon has expired' });
  }

  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    return errorResponse(res, { statusCode: 400, message: 'Coupon usage limit exceeded' });
  }

  const customerId = req.customer?.id || req.user?.id;
  const Cart = (await import('../../models/cart/Cart.js')).default;
  const cart = await Cart.findOne({ customerId });

  const subtotal = cart ? cart.pricing.subtotal : 0;

  if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
    return errorResponse(res, {
      statusCode: 400,
      message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon`
    });
  }

  let calculatedDiscount = 0;
  if (coupon.discountType === 'FLAT') {
    calculatedDiscount = coupon.discountAmount || 0;
  } else if (coupon.discountType === 'PERCENTAGE') {
    calculatedDiscount = (subtotal * (coupon.discountPercent || 0)) / 100;
    if (coupon.maxDiscount && calculatedDiscount > coupon.maxDiscount) {
      calculatedDiscount = coupon.maxDiscount;
    }
  }

  if (cart) {
    cart.couponCode = coupon.code;
    cart.discount = calculatedDiscount;
    cart.pricing.grandTotal = cart.pricing.subtotal + cart.pricing.packagingCharge
      + cart.pricing.platformFee + cart.pricing.deliveryFee + cart.pricing.gst
      - calculatedDiscount;
    if (cart.pricing.grandTotal < 0) cart.pricing.grandTotal = 0;
    await cart.save();
  }

  return successResponse(res, {
    message: `Coupon '${couponCode}' applied successfully`,
    data: {
      couponCode: coupon.code,
      couponTitle: coupon.title,
      discountType: coupon.discountType,
      discountPercent: coupon.discountPercent,
      discountAmount: calculatedDiscount,
      minOrderValue: coupon.minOrderValue,
      maxDiscount: coupon.maxDiscount,
      newGrandTotal: cart ? cart.pricing.grandTotal : null
    }
  });
});
