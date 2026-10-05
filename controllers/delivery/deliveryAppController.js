import Delivery from '../../models/delivery/Delivery.js';
import DeliveryPartner from '../../models/delivery/DeliveryPartner.js';
import Notification from '../../models/notifications/Notification.js';
import SupportTicket from '../../models/support/SupportTicket.js';
import Settlement from '../../models/settlements/Settlement.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';

const getPartnerId = (req) => {
  return req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
};

// ======================= EARNINGS APIS =======================

/**
 * @desc Get earnings summary with period filters
 * @route GET /api/delivery/earnings
 * @access Private (Delivery Partner)
 */
export const getEarnings = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { period = 'today', from, to } = req.query;

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    let periodLabel = "Total Earnings Today";

    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
      periodLabel = "Total Earnings This Week";
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
      periodLabel = "Total Earnings This Month";
    } else if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      periodLabel = "Total Earnings (Custom)";
    }

    const partner = await DeliveryPartner.findById(partnerId).lean();
    if (!partner) return errorResponse(res, { statusCode: 404, message: 'Partner not found' });

    const deliveries = await Delivery.find({
      deliveryPartnerId: partnerId,
      deliveryStatus: 'DELIVERED',
      deliveredAt: { $gte: startDate, $lt: endDate }
    }).lean();

    let totalEarnings = 0;
    const dateMap = {};

    deliveries.forEach(d => {
      const fee = d.pricingSnapshot?.deliveryFee || 0;
      totalEarnings += fee;

      const dateStr = d.deliveredAt.toISOString().split('T')[0];
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = { count: 0, amount: 0, rawDate: d.deliveredAt };
      }
      dateMap[dateStr].count++;
      dateMap[dateStr].amount += fee;
    });

    const deliveriesCount = deliveries.length;
    const avgPerDelivery = deliveriesCount > 0 ? totalEarnings / deliveriesCount : 0;

    const breakdowns = Object.values(dateMap).sort((a, b) => b.rawDate - a.rawDate).map(item => ({
      dateTitle: item.rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      deliveriesCount: item.count,
      amount: item.amount,
      amountFormatted: item.amount.toFixed(2)
    }));

    return successResponse(res, {
      data: {
        periodLabel,
        totalEarnings,
        totalEarningsFormatted: totalEarnings.toFixed(2),
        deliveriesCount,
        avgPerDelivery,
        avgPerDeliveryFormatted: avgPerDelivery.toFixed(2),
        payoutStatus: "PROCESSED",
        availableBalance: partner.walletBalance || 0, // Assuming partner schema supports walletBalance
        availableBalanceFormatted: (partner.walletBalance || 0).toFixed(2),
        settlementNote: "COD collections are settled after 24 hrs",
        bankInfo: partner.bankDetails ? `Bank A/c ending in ${partner.bankDetails.slice(-4)}` : 'Bank details not provided',
        breakdowns
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Request payout/withdrawal to bank account
 * @route POST /api/delivery/earnings/withdraw
 * @access Private (Delivery Partner)
 */
export const withdrawEarnings = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid amount' });
    }

    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) return errorResponse(res, { statusCode: 404, message: 'Partner not found' });

    const availableBalance = partner.walletBalance || 0;
    if (amount > availableBalance) {
      return errorResponse(res, { statusCode: 422, message: 'Insufficient balance' });
    }

    // Deduct
    partner.walletBalance = availableBalance - amount;
    await partner.save();

    // Create Settlement Record
    const transactionId = `TXN-${Date.now().toString().slice(-6)}`;
    await Settlement.create({
      settlementNumber: transactionId,
      entityType: 'DELIVERY_PARTNER',
      deliveryPartnerId: partnerId,
      amount: amount,
      netPayoutAmount: amount,
      status: 'PENDING',
      periodStart: new Date(),
      periodEnd: new Date(),
      grossEarnings: amount
    });

    if (req.io) {
      req.io.emit('partner:payout', { partnerId, amount, status: 'INITIATED' });
    }

    return successResponse(res, {
      message: 'Withdrawal request initiated successfully',
      data: {
        transactionId,
        amount,
        status: 'PENDING',
        estimatedSettlement: '2 business days'
      }
    });
  } catch (error) {
    next(error);
  }
};

// ======================= NOTIFICATION APIS =======================

/**
 * @desc Get notifications list with pagination
 * @route GET /api/delivery/notifications
 * @access Private (Delivery Partner)
 */
export const getNotifications = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { isRead, page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const query = { deliveryPartnerId: partnerId };
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ deliveryPartnerId: partnerId, isRead: false });
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const formattedNotifs = notifications.map(n => ({
      id: n._id,
      title: n.title,
      description: n.message,
      createdAt: n.createdAt,
      isRead: n.isRead,
      type: n.type || 'info'
    }));

    return successResponse(res, {
      data: {
        notifications: formattedNotifs,
        unreadCount,
        pagination: { page: pageNum, limit: limitNum, total }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Mark single notification as read
 * @route PUT /api/delivery/notifications/:notifId/read
 * @access Private (Delivery Partner)
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { notifId } = req.params;

    const notif = await Notification.findOneAndUpdate(
      { _id: notifId, deliveryPartnerId: partnerId },
      { isRead: true, readAt: new Date() }
    );

    if (!notif) return errorResponse(res, { statusCode: 404, message: 'Notification not found' });

    return successResponse(res, { message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Mark all notifications as read
 * @route PUT /api/delivery/notifications/read-all
 * @access Private (Delivery Partner)
 */
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    
    await Notification.updateMany(
      { deliveryPartnerId: partnerId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return successResponse(res, { message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// ======================= SUPPORT APIS =======================

/**
 * @desc Get FAQ list for support screen
 * @route GET /api/delivery/support/faqs
 * @access Private (Delivery Partner)
 */
export const getFAQs = async (req, res, next) => {
  try {
    // Usually from DB, returning static based on prompt requirements
    const faqs = [
      {
        id: "delivery_issues",
        title: "Delivery Issues",
        answer: "Please contact kitchen support immediately via chat if food is spilled or missing."
      },
      {
        id: "payment_settlements",
        title: "Payment & Settlements",
        answer: "Payouts are automatically settled to your registered bank account every Tuesday and Friday by 6:00 PM."
      },
      {
        id: "account_verification",
        title: "Account & Verification",
        answer: "Your partner badge is verified after standard KYC checks within 24-48 hours of onboarding."
      },
      {
        id: "app_navigation_issues",
        title: "App & Navigation Issues",
        answer: "If GPS deviates or map freezes, tap Re-center on the active order screen or toggle GPS from device settings."
      }
    ];

    return successResponse(res, { data: { faqs } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Submit support ticket
 * @route POST /api/delivery/support/ticket
 * @access Private (Delivery Partner)
 */
export const submitSupportTicket = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { category, subject, message, description, orderId, attachments } = req.body;

    const allowedCategories = ['ORDER_ISSUE', 'PAYMENT_ISSUE', 'CUSTOMER_UNREACHABLE', 'VEHICLE_BREAKDOWN', 'APP_ISSUE', 'OTHER'];
    if (!allowedCategories.includes(category)) {
      return errorResponse(res, { statusCode: 400, message: `Invalid category. Allowed: ${allowedCategories.join(', ')}` });
    }

    const ticketNumber = `TCK-${Date.now().toString().slice(-5)}`;

    await SupportTicket.create({
      ticketNumber,
      userType: 'DELIVERY_PARTNER',
      userId: partnerId,
      deliveryPartnerId: partnerId,
      category: category === 'PAYMENT_ISSUE' ? 'PAYMENT' : category === 'CUSTOMER_UNREACHABLE' ? 'DELIVERY' : category === 'VEHICLE_BREAKDOWN' ? 'OTHER' : category === 'APP_ISSUE' ? 'TECHNICAL' : category,
      subject: subject || category,
      description: description || message,
      orderId: orderId?.match(/^[0-9a-fA-F]{24}$/) ? orderId : undefined,
      attachments: attachments || [],
      status: 'OPEN',
      priority: 'MEDIUM'
    });

    return successResponse(res, {
      statusCode: 201,
      message: 'Support ticket created successfully',
      data: {
        ticketId: ticketNumber,
        status: 'OPEN',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// ======================= SUPPORT TICKETS LIST =======================

/**
 * @desc Get support tickets filed by logged-in partner
 * @route GET /api/delivery/support/tickets
 * @access Private (Delivery Partner)
 */
export const getSupportTickets = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);

    const tickets = await SupportTicket.find({ deliveryPartnerId: partnerId })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = tickets.map(t => ({
      ticketId: t.ticketNumber,
      category: t.category,
      subject: t.subject,
      description: t.description,
      status: t.status,
      resolution: t.messages?.filter(m => m.senderType === 'SUPPORT_AGENT').slice(-1)[0]?.message || null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));

    return successResponse(res, { data: { tickets: formatted } });
  } catch (error) {
    next(error);
  }
};

// ======================= WALLET APIS =======================

/**
 * @desc Get partner wallet balance
 * @route GET /api/delivery/wallet
 * @access Private (Delivery Partner)
 */
export const getWallet = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);

    const partner = await DeliveryPartner.findById(partnerId).lean();
    if (!partner) return errorResponse(res, { statusCode: 404, message: 'Partner not found' });

    return successResponse(res, {
      data: {
        walletBalance: partner.walletBalance || 0,
        walletBalanceFormatted: (partner.walletBalance || 0).toFixed(2),
        totalEarnings: partner.totalEarnings || 0,
        bankInfo: partner.bankDetails?.accountNumber
          ? `Bank A/c ending in ${partner.bankDetails.accountNumber.slice(-4)}`
          : 'Bank details not provided'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Instant payout to registered bank account
 * @route POST /api/delivery/wallet/payout
 * @access Private (Delivery Partner)
 */
export const walletPayout = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { amount, payoutMethod } = req.body;

    if (!amount || amount <= 0) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid amount' });
    }

    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) return errorResponse(res, { statusCode: 404, message: 'Partner not found' });

    const availableBalance = partner.walletBalance || 0;
    if (amount > availableBalance) {
      return errorResponse(res, { statusCode: 422, message: 'Insufficient wallet balance' });
    }

    partner.walletBalance = availableBalance - amount;
    await partner.save();

    const transactionId = `TXN-PAYOUT-${Date.now().toString().slice(-6)}`;

    await Settlement.create({
      settlementNumber: transactionId,
      entityType: 'DELIVERY_PARTNER',
      deliveryPartnerId: partnerId,
      amount,
      netPayoutAmount: amount,
      status: 'PENDING',
      periodStart: new Date(),
      periodEnd: new Date(),
      grossEarnings: amount
    });

    if (req.io) {
      req.io.emit('partner:payout', { partnerId, amount, status: 'PROCESSING' });
    }

    return successResponse(res, {
      message: `Payout of ₹${amount.toFixed(2)} initiated successfully to your registered bank account.`,
      data: {
        transactionId,
        payoutStatus: 'PROCESSING',
        remainingBalance: partner.walletBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

// ======================= PROFILE API =======================

/**
 * @desc Update partner profile information
 * @route PUT /api/delivery/partner/profile
 * @access Private (Delivery Partner)
 */
export const updateProfile = async (req, res, next) => {
  try {
    const partnerId = getPartnerId(req);
    const { fullName, email, vehicleType } = req.body;

    if (fullName && (fullName.length < 3 || fullName.length > 50)) {
      return errorResponse(res, { statusCode: 400, message: 'Name must be 3-50 chars' });
    }
    
    const validVehicles = ['Bike', 'Scooter', 'EV Bike', 'Bicycle', 'Car'];
    if (vehicleType && !validVehicles.includes(vehicleType)) {
      return errorResponse(res, { statusCode: 400, message: 'Invalid vehicle type' });
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      { fullName, email, vehicleType },
      { new: true, runValidators: true }
    );

    if (!partner) return errorResponse(res, { statusCode: 404, message: 'Partner not found' });

    return successResponse(res, {
      data: {
        partner: {
          id: partner._id,
          mobile: partner.mobile,
          fullName: partner.fullName,
          email: partner.email,
          vehicleType: partner.vehicleType,
          isActive: partner.isActive,
          onboardingStatus: partner.onboardingStatus
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
