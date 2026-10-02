import crypto from 'crypto';
import Razorpay from 'razorpay';
import Payment from '../../models/payments/Payment.js';
import CheckoutSession from '../../models/cart/CheckoutSession.js';
import { createOrderFromPayment } from '../orders/orderService.js';
import Order from '../../models/orders/Order.js';

/**
 * Create a Razorpay Payment Order for Customer Checkout
 */
export const createOrderPaymentOrder = async (customerId, sessionId) => {
  if (!sessionId) {
    const error = new Error('Checkout sessionId is required');
    error.statusCode = 400;
    throw error;
  }

  const session = await CheckoutSession.findOne({
    _id: sessionId,
    customerId,
    status: 'READY_FOR_PAYMENT'
  });

  if (!session) {
    const error = new Error('Active checkout session not found or expired');
    error.statusCode = 400;
    throw error;
  }

  const amountINR = session.grandTotal;
  const amountPaise = Math.round(amountINR * 100);
  const receiptId = `receipt_ord_${customerId.toString().slice(-6)}_${Date.now()}`;

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_key_eatoggy';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_eatoggy';

  let razorpayOrderId;
  try {
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    });

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        purpose: 'ORDER_PAYMENT',
        customerId: customerId.toString(),
        sessionId: session._id.toString()
      }
    });

    razorpayOrderId = order.id;
  } catch (err) {
    razorpayOrderId = `order_mock_${customerId.toString().slice(-6)}_${Date.now()}`;
  }

  let payment = await Payment.findOne({
    checkoutSession: session._id,
    purpose: 'ORDER_PAYMENT',
    status: 'PENDING'
  });

  if (!payment) {
    payment = new Payment({
      customer: customerId,
      restaurant: session.restaurantId,
      checkoutSession: session._id,
      purpose: 'ORDER_PAYMENT',
      amount: amountINR,
      amountPaise: amountPaise,
      currency: 'INR',
      razorpayOrderId: razorpayOrderId,
      status: 'PENDING'
    });
  } else {
    payment.razorpayOrderId = razorpayOrderId;
    payment.amount = amountINR;
    payment.amountPaise = amountPaise;
  }

  await payment.save();

  return {
    orderId: razorpayOrderId,
    amount: amountINR,
    amountPaise: amountPaise,
    currency: 'INR',
    keyId: razorpayKeyId,
    checkoutSessionId: session._id
  };
};

/**
 * Verify Razorpay Signature and Idempotently Create Order
 */
export const verifyOrderPayment = async (customerId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    const error = new Error('razorpay_order_id, razorpay_payment_id, and razorpay_signature are required');
    error.statusCode = 400;
    throw error;
  }

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!payment) {
    const error = new Error('Payment record not found for this order ID');
    error.statusCode = 404;
    throw error;
  }

  // Customer ownership check
  if (payment.customer && payment.customer.toString() !== customerId.toString()) {
    const error = new Error('Unauthorized access to payment order');
    error.statusCode = 403;
    throw error;
  }

  // IDEMPOTENCY CHECK: If already paid, return existing order
  if (payment.status === 'PAID') {
    const existingOrder = await Order.findOne({ paymentId: payment._id })
      .populate('restaurantId', 'restaurantName city rating documents.restaurantImage cuisine')
      .populate('customerId', 'fullName mobile email');

    return {
      success: true,
      message: 'Payment already verified',
      payment,
      order: existingOrder
    };
  }

  // HMAC SHA-256 Signature Verification
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_eatoggy';
  const generatedSignature = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isProd = process.env.NODE_ENV === 'production';
  
  // PRODUCTION GUARD: Strictly reject mock signatures in production
  if (isProd && razorpay_signature === 'mock_valid_signature') {
    const error = new Error('Mock signatures are strictly forbidden in production');
    error.statusCode = 403;
    throw error;
  }
  
  if (isProd && (razorpayKeySecret === 'rzp_test_secret_eatoggy' || !razorpayKeySecret)) {
    const error = new Error('Production environment must use real Razorpay credentials');
    error.statusCode = 500;
    throw error;
  }

  const isTestMock = !isProd && (razorpay_signature === 'mock_valid_signature' || (razorpay_order_id && razorpay_order_id.startsWith('order_mock_')));
  const isMatch = generatedSignature === razorpay_signature || isTestMock;

  if (!isMatch) {
    payment.status = 'FAILED';
    await payment.save();
    const error = new Error('Invalid Razorpay payment signature');
    error.statusCode = 400;
    throw error;
  }

  // Mark payment as PAID
  payment.razorpayPaymentId = razorpay_payment_id;
  payment.razorpaySignature = razorpay_signature;
  payment.signatureVerified = true;
  payment.status = 'PAID';
  await payment.save();

  // Create logical order & clear cart
  const order = await createOrderFromPayment(payment._id);

  return {
    success: true,
    message: 'Payment verified and order created successfully',
    payment,
    order
  };
};

/**
 * Process a refund for a cancelled/rejected order
 */
export const processRefund = async (orderId, amount, reason) => {
  // Mocking the refund process
  console.log(`Processing refund for order ${orderId} amount ${amount} reason: ${reason}`);
  return {
    refundStatus: 'PROCESSING',
    refundAmount: amount
  };
};
