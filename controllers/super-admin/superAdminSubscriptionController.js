import Subscription from '../../models/subscriptions/Subscription.js';
import SubscriptionOccurrence from '../../models/subscriptions/SubscriptionOccurrence.js';

/**
 * @desc    Get all subscriptions across platform
 * @route   GET /api/super-admin/subscriptions
 * @access  Private/SuperAdmin
 */
export const getAllSubscriptions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { search, status } = req.query;

    const filter = {};

    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { subscriptionNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Subscription.countDocuments(filter);
    const subscriptions = await Subscription.find(filter)
      .populate('customerId', 'name mobile email')
      .populate('restaurantId', 'name mobile')
      .populate('planId', 'name mealType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: subscriptions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get single subscription details with occurrence history
 * @route   GET /api/super-admin/subscriptions/:id
 * @access  Private/SuperAdmin
 */
export const getSubscriptionDetails = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('customerId', 'name mobile email')
      .populate('restaurantId', 'name mobile address')
      .populate('planId')
      .populate('paymentId')
      .lean();

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    const occurrences = await SubscriptionOccurrence.find({ subscriptionId: req.params.id })
      .sort({ scheduledDate: 1 })
      .populate('orderId')
      .lean();

    res.json({
      success: true,
      data: {
        subscription,
        occurrences
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Admin override to cancel an active subscription
 * @route   PATCH /api/super-admin/subscriptions/:id/cancel
 * @access  Private/SuperAdmin
 */
export const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') {
      return res.status(400).json({ success: false, message: `Subscription is already ${subscription.status.toLowerCase()}` });
    }

    subscription.status = 'CANCELLED';
    subscription.cancelledAt = new Date();
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription cancelled successfully by Admin',
      data: subscription
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Admin override to pause an active subscription
 * @route   PATCH /api/super-admin/subscriptions/:id/pause
 * @access  Private/SuperAdmin
 */
export const pauseSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (subscription.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: `Only ACTIVE subscriptions can be paused. Current status: ${subscription.status}` });
    }

    subscription.status = 'PAUSED';
    subscription.pausedAt = new Date();
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription paused successfully by Admin',
      data: subscription
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
