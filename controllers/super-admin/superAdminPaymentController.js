import Payment from '../../models/payments/Payment.js';
import Order from '../../models/orders/Order.js';
import Subscription from '../../models/subscriptions/Subscription.js';

/**
 * @desc    Get all payment records across platform
 * @route   GET /api/super-admin/payments
 * @access  Private/SuperAdmin
 */
export const getAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const { status, purpose, search } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (purpose) filter.purpose = purpose;

    if (search) {
      filter.$or = [
        { razorpayOrderId: { $regex: search, $options: 'i' } },
        { razorpayPaymentId: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
      .populate('customer', 'name mobile email')
      .populate('restaurant', 'name mobile')
      .populate('subscription', 'subscriptionNumber pricing')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: payments,
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
 * @desc    Initiate payment refund for order or subscription
 * @route   POST /api/super-admin/payments/:id/refund
 * @access  Private/SuperAdmin
 */
export const initiateRefund = async (req, res) => {
  try {
    const { reason, refundAmount } = req.body;
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    if (payment.status === 'REFUNDED') {
      return res.status(400).json({ success: false, message: 'Payment is already refunded' });
    }

    if (payment.status !== 'PAID') {
      return res.status(400).json({ success: false, message: `Cannot refund payment with status ${payment.status}` });
    }

    // Validate server-side refund amount
    const originalAmount = Number(payment.amount || 0);
    const amountToRefund = (refundAmount !== undefined && refundAmount !== null && refundAmount !== '')
      ? Number(refundAmount)
      : originalAmount;

    if (isNaN(amountToRefund) || amountToRefund <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid refund amount' });
    }

    if (originalAmount > 0 && amountToRefund > originalAmount) {
      return res.status(400).json({ success: false, message: `Refund amount (₹${amountToRefund}) cannot exceed original payment amount (₹${originalAmount})` });
    }
    if (originalAmount === 0 && amountToRefund > 0) {
      return res.status(400).json({ success: false, message: `Refund amount (₹${amountToRefund}) cannot exceed original payment amount (₹${originalAmount})` });
    }

    // Atomic update to prevent race conditions & duplicate refunds
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: req.params.id, status: 'PAID' },
      {
        $set: {
          status: 'REFUNDED',
          refundDetails: {
            refundedAt: new Date(),
            refundAmount: amountToRefund,
            reason: reason || 'Admin initiated refund',
            refundId: `rfnd_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (!updatedPayment) {
      return res.status(400).json({ success: false, message: 'Payment refund conflict or already processed' });
    }

    // Sync subscription payment status if subscription payment
    if (updatedPayment.subscription) {
      await Subscription.findByIdAndUpdate(updatedPayment.subscription, { paymentStatus: 'REFUNDED', status: 'CANCELLED' });
    }

    res.json({
      success: true,
      message: 'Refund initiated successfully',
      data: updatedPayment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
