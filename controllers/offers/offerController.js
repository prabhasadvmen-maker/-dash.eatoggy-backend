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

  // Check the user's cart in the DB
  const customerId = req.customer?.id || req.user?.id;
  const Cart = (await import('../../models/cart/Cart.js')).default;
  const cart = await Cart.findOne({ customerId });

  if (!cart) {
    return errorResponse(res, { statusCode: 404, message: 'Cart not found' });
  }

  if (cart.pricing.subtotal < coupon.minOrderValue) {
    return errorResponse(res, { 
      statusCode: 400, 
      message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon` 
    });
  }

  let calculatedDiscount = 0;
  if (coupon.discountType === 'FLAT') {
    calculatedDiscount = coupon.discountAmount;
  } else if (coupon.discountType === 'PERCENTAGE') {
    calculatedDiscount = (cart.pricing.subtotal * coupon.discountPercent) / 100;
    if (coupon.maxDiscount && calculatedDiscount > coupon.maxDiscount) {
      calculatedDiscount = coupon.maxDiscount;
    }
  }

  cart.couponCode = coupon.code;
  // This assumes discount is a field in cart, we can just reduce the grandTotal directly
  // or update a specific field. We'll deduct it from grandTotal and add a discount field
  cart.discount = calculatedDiscount;
  
  // Recalculate grand total
  cart.pricing.grandTotal = cart.pricing.subtotal + cart.pricing.packagingCharge 
    + cart.pricing.platformFee + cart.pricing.deliveryFee + cart.pricing.gst 
    - calculatedDiscount;

  if (cart.pricing.grandTotal < 0) cart.pricing.grandTotal = 0;

  await cart.save();

  return successResponse(res, {
    message: `Coupon '${couponCode}' applied successfully`,
    data: {
      couponCode: coupon.code,
      couponTitle: coupon.title,
      discountType: coupon.discountType,
      discountAmount: calculatedDiscount,
      newGrandTotal: cart.pricing.grandTotal,
      cart
    }
  });
});
