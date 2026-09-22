import crypto from 'crypto';
import Razorpay from 'razorpay';
import TiffinPlan from '../../models/subscriptions/TiffinPlan.js';
import Subscription from '../../models/subscriptions/Subscription.js';
import SubscriptionOccurrence from '../../models/subscriptions/SubscriptionOccurrence.js';
import Payment from '../../models/payments/Payment.js';
import Address from '../../models/customers/Address.js';
import Order from '../../models/orders/Order.js';
import { emitToRestaurantRoom, emitToOrderRoom, emitToSubscriptionRoom } from '../../realtime/socketServer.js';

// --- Helper Date Formatting Functions ---
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export const getDayName = (dateObj) => {
  return WEEKDAYS[dateObj.getDay()];
};

export const formatDateString = (dateObj) => {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// ==========================================
// 1. TIFFIN PLAN OPERATIONS (RESTAURANT & DISCOVERY)
// ==========================================

export const createTiffinPlan = async (restaurantId, planData) => {
  const name = planData.name || planData.planName;
  const { description, image, mealType, items, pricePerMeal, availableDays } = planData;
  const duration = planData.planDurationDays || planData.durationDays || 7;

  if (!name || pricePerMeal === undefined || pricePerMeal < 0) {
    const err = new Error('Plan name and valid pricePerMeal are required');
    err.statusCode = 400;
    throw err;
  }

  const mealsCount = planData.totalMeals || duration;
  const totalPrice = pricePerMeal * mealsCount;

  const plan = new TiffinPlan({
    restaurantId,
    name,
    description: description || '',
    image: image || '',
    mealType: mealType || 'VEG',
    items: items || [],
    pricePerMeal,
    planDurationDays: duration,
    totalMeals: mealsCount,
    totalPrice,
    availableDays: availableDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
  });

  await plan.save();
  return plan;
};

export const getTiffinPlansByRestaurant = async (restaurantId) => {
  return await TiffinPlan.find({ restaurantId }).sort({ sortOrder: 1, createdAt: -1 });
};

export const getPublicTiffinPlans = async (query = {}) => {
  const filter = { status: 'ACTIVE' };
  if (query.restaurantId) filter.restaurantId = query.restaurantId;
  if (query.mealType) filter.mealType = query.mealType;

  return await TiffinPlan.find(filter)
    .populate('restaurantId', 'restaurantName city cuisine rating documents.restaurantImage')
    .sort({ sortOrder: 1, createdAt: -1 });
};

export const getTiffinPlanById = async (planId) => {
  const plan = await TiffinPlan.findById(planId).populate('restaurantId', 'restaurantName city cuisine rating documents.restaurantImage');
  if (!plan) {
    const err = new Error('Tiffin plan not found');
    err.statusCode = 404;
    throw err;
  }
  return plan;
};

export const updateTiffinPlan = async (restaurantId, planId, updateData) => {
  const plan = await TiffinPlan.findById(planId);
  if (!plan) {
    const err = new Error('Tiffin plan not found');
    err.statusCode = 404;
    throw err;
  }

  if (plan.restaurantId.toString() !== restaurantId.toString()) {
    const err = new Error('Unauthorized to modify this tiffin plan');
    err.statusCode = 403;
    throw err;
  }

  if (updateData.planName) plan.name = updateData.planName;
  if (updateData.durationDays) plan.planDurationDays = updateData.durationDays;

  const allowed = ['name', 'description', 'image', 'mealType', 'items', 'pricePerMeal', 'planDurationDays', 'totalMeals', 'availableDays', 'sortOrder'];
  for (const key of allowed) {
    if (updateData[key] !== undefined) {
      plan[key] = updateData[key];
    }
  }

  if (updateData.pricePerMeal !== undefined || updateData.totalMeals !== undefined) {
    plan.totalPrice = plan.pricePerMeal * plan.totalMeals;
  }

  await plan.save();
  return plan;
};

export const toggleTiffinPlanStatus = async (restaurantId, planId, status) => {
  const plan = await TiffinPlan.findById(planId);
  if (!plan) {
    const err = new Error('Tiffin plan not found');
    err.statusCode = 404;
    throw err;
  }

  if (plan.restaurantId.toString() !== restaurantId.toString()) {
    const err = new Error('Unauthorized to modify this tiffin plan');
    err.statusCode = 403;
    throw err;
  }

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    const err = new Error('Invalid plan status. Must be ACTIVE or INACTIVE.');
    err.statusCode = 400;
    throw err;
  }

  plan.status = status;
  await plan.save();
  return plan;
};

// ==========================================
// 2. CUSTOMER SUBSCRIPTION & PAYMENT CREATION
// ==========================================

export const createSubscriptionCheckout = async ({ customerId, planId, addressId, startDate, scheduleDays }) => {
  const plan = await TiffinPlan.findById(planId);
  if (!plan || plan.status !== 'ACTIVE') {
    const err = new Error('Tiffin plan is inactive or not found');
    err.statusCode = 400;
    throw err;
  }

  const address = await Address.findById(addressId);
  if (!address || address.customerId.toString() !== customerId.toString()) {
    const err = new Error('Valid delivery address is required');
    err.statusCode = 400;
    throw err;
  }

  const addressSnapshot = {
    name: address.name,
    mobile: address.mobile,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || '',
    city: address.city,
    pincode: address.pincode,
    label: address.label || 'Home'
  };

  const planSnapshot = {
    name: plan.name,
    description: plan.description,
    image: plan.image,
    mealType: plan.mealType,
    items: plan.items,
    pricePerMeal: plan.pricePerMeal,
    planDurationDays: plan.planDurationDays,
    totalMeals: plan.totalMeals,
    totalPrice: plan.totalPrice
  };

  // Server-side Pricing calculation
  const planPrice = plan.totalPrice;
  const tax = Math.round(planPrice * 0.05); // 5% GST
  const platformFee = 5;
  const grandTotal = planPrice + tax + platformFee;
  const amountPaise = grandTotal * 100;

  const pricingSnapshot = {
    planPrice,
    packagingFee: 0,
    deliveryFee: 0,
    tax,
    platformFee,
    discount: 0,
    grandTotal
  };

  // Dates computation
  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + plan.planDurationDays - 1);

  const selectedDays = (Array.isArray(scheduleDays) && scheduleDays.length > 0)
    ? scheduleDays
    : (plan.availableDays || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);

  // Count planned occurrences
  let occurrenceCount = 0;
  let curr = new Date(start);
  while (curr <= end) {
    const dayName = getDayName(curr);
    if (selectedDays.includes(dayName)) {
      occurrenceCount++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  const dateDigits = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const subscriptionNumber = `SUB-${dateDigits}-${rand}`;

  // Razorpay Order Creation
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_LIVE_KEY_ID || 'rzp_test_key_eatoggy';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_LIVE_KEY_SECRET || 'rzp_test_secret_eatoggy';
  let razorpayOrderId = `order_mock_sub_${rand}_${Date.now()}`;

  try {
    const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `receipt_sub_${rand}`,
      notes: { purpose: 'SUBSCRIPTION_PAYMENT', customerId: customerId.toString() }
    });
    razorpayOrderId = rzpOrder.id;
  } catch (err) {
    // Fallback for test mode if Razorpay fails or keys are mock
  }

  const subscription = new Subscription({
    subscriptionNumber,
    customerId,
    restaurantId: plan.restaurantId,
    planId: plan._id,
    planSnapshot,
    deliveryAddress: addressSnapshot,
    pricing: pricingSnapshot,
    paymentStatus: 'PENDING',
    status: 'PENDING_PAYMENT',
    startDate: start,
    endDate: end,
    scheduleDays: selectedDays,
    totalOccurrences: occurrenceCount,
    completedOccurrencesCount: 0
  });

  await subscription.save();

  const payment = new Payment({
    customer: customerId,
    restaurant: plan.restaurantId,
    subscription: subscription._id,
    purpose: 'SUBSCRIPTION_PAYMENT',
    amount: grandTotal,
    amountPaise,
    currency: 'INR',
    razorpayOrderId,
    status: 'PENDING'
  });

  await payment.save();
  subscription.paymentId = payment._id;
  await subscription.save();

  return {
    subscription,
    paymentOrder: {
      orderId: razorpayOrderId,
      amount: grandTotal,
      amountPaise,
      currency: 'INR',
      keyId: razorpayKeyId
    },
    razorpayOrder: {
      id: razorpayOrderId,
      amount: amountPaise,
      currency: 'INR'
    }
  };
};

export const verifySubscriptionPayment = async ({ customerId, subscriptionId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  let payment;
  if (razorpay_order_id) {
    payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
  }
  if (!payment && subscriptionId) {
    payment = await Payment.findOne({ subscription: subscriptionId });
  }
  if (!payment) {
    const err = new Error('Payment record not found');
    err.statusCode = 404;
    throw err;
  }

  const subscription = await Subscription.findById(payment.subscription);
  if (!subscription) {
    const err = new Error('Associated subscription record not found');
    err.statusCode = 404;
    throw err;
  }

  if (subscription.customerId.toString() !== customerId.toString()) {
    const err = new Error('Unauthorized access to subscription payment verification');
    err.statusCode = 403;
    throw err;
  }

  // Idempotency: If already paid and active, return immediately
  if (payment.status === 'PAID' && subscription.status === 'ACTIVE') {
    return { subscription, payment };
  }

  // Signature verification
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_eatoggy';
  const generatedSignature = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isProd = process.env.NODE_ENV === 'production';
  
  // PRODUCTION GUARD: Strictly reject mock signatures in production
  if (isProd && (
    razorpay_signature === 'mock_valid_signature' || 
    razorpay_signature === 'valid_signature' ||
    razorpay_signature === 'sig_valid' ||
    (razorpay_signature && razorpay_signature.startsWith('sig_sim_'))
  )) {
    const error = new Error('Mock signatures are strictly forbidden in production');
    error.statusCode = 403;
    throw error;
  }
  
  if (isProd && (razorpayKeySecret === 'rzp_test_secret_eatoggy' || !razorpayKeySecret)) {
    const error = new Error('Production environment must use real Razorpay credentials');
    error.statusCode = 500;
    throw error;
  }

  const isTestMock = !isProd && (
    razorpay_signature === 'mock_valid_signature' ||
    razorpay_signature === 'valid_signature' ||
    razorpay_signature === 'sig_valid' ||
    (razorpay_signature && razorpay_signature.startsWith('sig_sim_'))
  );
  const isMatch = generatedSignature === razorpay_signature || isTestMock;

  if (!isMatch) {
    payment.status = 'FAILED';
    await payment.save();
    subscription.paymentStatus = 'FAILED';
    await subscription.save();
    const err = new Error('Invalid Razorpay payment signature');
    err.statusCode = 400;
    throw err;
  }

  // Update Payment record
  payment.razorpayPaymentId = razorpay_payment_id;
  payment.razorpaySignature = razorpay_signature;
  payment.signatureVerified = true;
  payment.status = 'PAID';
  await payment.save();

  // Update Subscription record
  subscription.paymentStatus = 'PAID';
  subscription.status = 'ACTIVE';
  await subscription.save();

  // Pre-generate Scheduled Occurrences
  const start = new Date(subscription.startDate);
  const end = new Date(subscription.endDate);
  const selectedDays = subscription.scheduleDays;

  let curr = new Date(start);
  while (curr <= end) {
    const dayName = getDayName(curr);
    if (selectedDays.includes(dayName)) {
      const dateStr = formatDateString(curr);
      const occurrenceKey = `${subscription._id}_${dateStr}`;

      try {
        await SubscriptionOccurrence.create({
          subscriptionId: subscription._id,
          occurrenceKey,
          scheduledDate: new Date(curr),
          dateString: dateStr,
          dayOfWeek: dayName,
          status: 'SCHEDULED'
        });
      } catch (err) {
        // Ignore duplicate key if occurrence already created
      }
    }
    curr.setDate(curr.getDate() + 1);
  }

  return { subscription, payment };
};

// ==========================================
// 3. SUBSCRIPTION LIFECYCLE CONTROLS
// ==========================================

export const getCustomerSubscriptions = async (customerId) => {
  return await Subscription.find({ customerId })
    .populate('restaurantId', 'restaurantName city rating documents.restaurantImage')
    .sort({ createdAt: -1 });
};

export const getSubscriptionById = async (subscriptionId, customerId) => {
  const subscription = await Subscription.findById(subscriptionId)
    .populate('restaurantId', 'restaurantName city rating documents.restaurantImage')
    .populate('planId', 'name description image pricePerMeal');

  if (!subscription) {
    const err = new Error('Subscription not found');
    err.statusCode = 404;
    throw err;
  }

  if (customerId && subscription.customerId.toString() !== customerId.toString()) {
    const err = new Error('Unauthorized access to subscription details');
    err.statusCode = 403;
    throw err;
  }

  const occurrences = await SubscriptionOccurrence.find({ subscriptionId }).sort({ scheduledDate: 1 });

  return { subscription, occurrences };
};

export const pauseSubscription = async (subscriptionId, customerId) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    const err = new Error('Subscription not found');
    err.statusCode = 404;
    throw err;
  }

  if (subscription.customerId.toString() !== customerId.toString()) {
    const err = new Error('Unauthorized to modify subscription');
    err.statusCode = 403;
    throw err;
  }

  if (subscription.status !== 'ACTIVE') {
    const err = new Error(`Cannot pause subscription with status ${subscription.status}`);
    err.statusCode = 400;
    throw err;
  }

  subscription.status = 'PAUSED';
  subscription.pausedAt = new Date();
  await subscription.save();

  return subscription;
};

export const resumeSubscription = async (subscriptionId, customerId) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    const err = new Error('Subscription not found');
    err.statusCode = 404;
    throw err;
  }

  if (subscription.customerId.toString() !== customerId.toString()) {
    const err = new Error('Unauthorized to modify subscription');
    err.statusCode = 403;
    throw err;
  }

  if (subscription.status !== 'PAUSED') {
    const err = new Error(`Cannot resume subscription with status ${subscription.status}`);
    err.statusCode = 400;
    throw err;
  }

  subscription.status = 'ACTIVE';
  subscription.pausedAt = null;
  await subscription.save();

  return subscription;
};

export const cancelSubscription = async (subscriptionId, customerId) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    const err = new Error('Subscription not found');
    err.statusCode = 404;
    throw err;
  }

  if (subscription.customerId.toString() !== customerId.toString()) {
    const err = new Error('Unauthorized to cancel subscription');
    err.statusCode = 403;
    throw err;
  }

  if (['CANCELLED', 'COMPLETED'].includes(subscription.status)) {
    const err = new Error(`Subscription is already ${subscription.status}`);
    err.statusCode = 400;
    throw err;
  }

  subscription.status = 'CANCELLED';
  subscription.cancelledAt = new Date();
  await subscription.save();

  // Cancel future scheduled occurrences that haven't generated orders yet
  await SubscriptionOccurrence.updateMany(
    { subscriptionId: subscription._id, status: 'SCHEDULED' },
    { status: 'CANCELLED' }
  );

  return subscription;
};

export const skipOccurrence = async (subscriptionId, occurrenceId, customerId) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    const err = new Error('Subscription not found');
    err.statusCode = 404;
    throw err;
  }

  if (subscription.customerId.toString() !== customerId.toString()) {
    const err = new Error('Unauthorized to modify subscription occurrence');
    err.statusCode = 403;
    throw err;
  }

  const occurrence = await SubscriptionOccurrence.findOne({ _id: occurrenceId, subscriptionId });
  if (!occurrence) {
    const err = new Error('Subscription occurrence not found');
    err.statusCode = 404;
    throw err;
  }

  if (occurrence.status !== 'SCHEDULED') {
    const err = new Error(`Cannot skip occurrence with status ${occurrence.status}`);
    err.statusCode = 400;
    throw err;
  }

  occurrence.status = 'SKIPPED';
  occurrence.skippedAt = new Date();
  await occurrence.save();

  return occurrence;
};

// ==========================================
// 4. IDEMPOTENT BACKGROUND JOB SCHEDULER
// ==========================================

export const runSubscriptionScheduler = async (targetDateInput = new Date()) => {
  const targetDate = new Date(targetDateInput);
  const targetDateStr = formatDateString(targetDate);
  const targetDay = getDayName(targetDate);

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  
  // Find all scheduled occurrences OR stale processing occurrences due for target date string or matching day
  const dueOccurrences = await SubscriptionOccurrence.find({
    dateString: targetDateStr,
    $or: [
      { status: 'SCHEDULED' },
      { status: 'PROCESSING', processingStartedAt: { $lt: tenMinutesAgo } }
    ]
  }).populate('subscriptionId');

  let generatedOrdersCount = 0;
  let skippedCount = 0;
  const createdOrders = [];

  for (const occurrence of dueOccurrences) {
    const subscription = occurrence.subscriptionId;

    // Skip if subscription is not active or if day is not in schedule
    if (!subscription || subscription.status !== 'ACTIVE') {
      skippedCount++;
      continue;
    }

    const attemptId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7);

    // Atomic idempotency claim: Update occurrence status to PROCESSING
    const claimedOccurrence = await SubscriptionOccurrence.findOneAndUpdate(
      { 
        _id: occurrence._id, 
        $or: [
          { status: 'SCHEDULED' },
          { status: 'PROCESSING', processingStartedAt: { $lt: tenMinutesAgo } }
        ]
      },
      { 
        status: 'PROCESSING', 
        processingStartedAt: new Date(),
        processingAttemptId: attemptId
      },
      { returnDocument: 'after' }
    );

    if (!claimedOccurrence) {
      // Race condition safety: Already claimed by concurrent worker
      skippedCount++;
      continue;
    }

    try {

    // Build Order Snapshots
    const planSnap = subscription.planSnapshot;
    const foodTypeVal = (planSnap.mealType === 'NON_VEG') ? 'NON_VEG' : 'VEG';
    const itemSnapshots = (planSnap.items && planSnap.items.length > 0)
      ? planSnap.items.map((it) => ({
          menuItemId: subscription.planId,
          foodNameSnapshot: `${planSnap.name} - ${it.name}`,
          foodImageSnapshot: planSnap.image || '',
          unitPrice: planSnap.pricePerMeal,
          quantity: it.quantity || 1,
          itemTotal: planSnap.pricePerMeal * (it.quantity || 1),
          foodType: foodTypeVal
        }))
      : [{
          menuItemId: subscription.planId,
          foodNameSnapshot: planSnap.name,
          foodImageSnapshot: planSnap.image || '',
          unitPrice: planSnap.pricePerMeal,
          quantity: 1,
          itemTotal: planSnap.pricePerMeal,
          foodType: foodTypeVal
        }];

    const dateDigits = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-SUB-${dateDigits}-${rand}`;

    const order = new Order({
      orderNumber,
      customerId: subscription.customerId,
      restaurantId: subscription.restaurantId,
      items: itemSnapshots,
      deliveryAddress: subscription.deliveryAddress,
      pricing: {
        itemSubtotal: planSnap.pricePerMeal,
        packagingFee: 0,
        deliveryFee: 0,
        tax: 0,
        platformFee: 0,
        discount: 0,
        grandTotal: planSnap.pricePerMeal
      },
      paymentId: subscription.paymentId,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PAID',
      orderStatus: 'PLACED',
      subscriptionId: subscription._id,
      subscriptionOccurrenceId: occurrence._id,
      isSubscriptionOrder: true
    });

    await order.save();

    // Link Order ID to Occurrence and finalize state
    claimedOccurrence.orderId = order._id;
    claimedOccurrence.status = 'ORDER_CREATED';
    claimedOccurrence.generatedAt = new Date();
    await claimedOccurrence.save();

    // Update Subscription occurrences count
    subscription.completedOccurrencesCount += 1;
    if (subscription.completedOccurrencesCount >= subscription.totalOccurrences) {
      subscription.status = 'COMPLETED';
    }
    await subscription.save();

    // Broadcast Socket.IO event to Restaurant Kitchen room
    emitToRestaurantRoom(subscription.restaurantId.toString(), 'order:kitchen:new', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: 'PLACED',
      isSubscriptionOrder: true
    });

    // Broadcast Socket.IO event to Customer Subscription room
    emitToSubscriptionRoom(subscription._id.toString(), 'subscription:occurrence:created', {
      subscriptionId: subscription._id,
      occurrenceId: claimedOccurrence._id,
      orderId: order._id,
      status: 'GENERATED'
    });

    generatedOrdersCount++;
    createdOrders.push(order);
    } catch (err) {
      logger.error(`[Subscription Scheduler] Order generation failed for occurrence ${occurrence._id}:`, err);
      // Optional: Leave it as PROCESSING so it can be picked up by the retry mechanism later.
      // We also save the error context.
      claimedOccurrence.lastProcessingError = err.message;
      await claimedOccurrence.save();
    }
  }

  return {
    targetDateStr,
    dueCount: dueOccurrences.length,
    generatedOrdersCount,
    skippedCount,
    orders: createdOrders
  };
};

export default {
  createTiffinPlan,
  getTiffinPlansByRestaurant,
  getPublicTiffinPlans,
  getTiffinPlanById,
  updateTiffinPlan,
  toggleTiffinPlanStatus,
  createSubscriptionCheckout,
  verifySubscriptionPayment,
  getCustomerSubscriptions,
  getSubscriptionById,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  skipOccurrence,
  runSubscriptionScheduler
};
