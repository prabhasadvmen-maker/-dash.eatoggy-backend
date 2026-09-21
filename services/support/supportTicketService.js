import SupportTicket from '../../models/support/SupportTicket.js';
import Order from '../../models/orders/Order.js';
import Subscription from '../../models/subscriptions/Subscription.js';
import SubscriptionOccurrence from '../../models/subscriptions/SubscriptionOccurrence.js';

/**
 * Valid state transitions for Support Ticket state machine
 */
const VALID_STATE_TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_PARTNER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'WAITING_FOR_PARTNER', 'RESOLVED', 'CLOSED', 'OPEN'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'OPEN'],
  WAITING_FOR_PARTNER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'OPEN'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN']
};

/**
 * Create a new support ticket with entity validation
 */
export const createTicket = async ({
  userType,
  userId,
  subject,
  description,
  category = 'ORDER_ISSUE',
  priority = 'MEDIUM',
  orderId = null,
  subscriptionId = null,
  subscriptionOccurrenceId = null,
  attachments = []
}) => {
  if (!subject || !description) {
    throw new Error('Subject and description are required');
  }

  // 1. Entity Validation if orderId is supplied
  if (orderId) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Referenced order not found');
    }
    // Verify requester ownership of order
    if (userType === 'CUSTOMER' && order.customerId?.toString() !== userId.toString()) {
      throw new Error('Unauthorized to reference an order not belonging to you');
    }
    if (userType === 'RESTAURANT' && order.restaurantId?.toString() !== userId.toString()) {
      throw new Error('Unauthorized to reference an order for a different restaurant');
    }
  }

  // 2. Entity Validation if subscriptionId is supplied
  if (subscriptionId) {
    const sub = await Subscription.findById(subscriptionId);
    if (!sub) {
      throw new Error('Referenced subscription not found');
    }
    if (userType === 'CUSTOMER' && sub.customerId?.toString() !== userId.toString()) {
      throw new Error('Unauthorized to reference a subscription not belonging to you');
    }
    if (userType === 'RESTAURANT' && sub.restaurantId?.toString() !== userId.toString()) {
      throw new Error('Unauthorized to reference a subscription for a different restaurant');
    }
  }

  // 3. Entity Validation if subscriptionOccurrenceId is supplied
  if (subscriptionOccurrenceId) {
    const occ = await SubscriptionOccurrence.findById(subscriptionOccurrenceId);
    if (!occ) {
      throw new Error('Referenced subscription occurrence not found');
    }
  }

  // Generate unique human-readable ticket number
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const ticketNumber = `TKT-${datePrefix}-${randomSuffix}`;

  const roleFields = {};
  if (userType === 'CUSTOMER') roleFields.customerId = userId;
  if (userType === 'RESTAURANT') roleFields.restaurantId = userId;
  if (userType === 'DELIVERY_PARTNER') roleFields.deliveryPartnerId = userId;

  const ticket = await SupportTicket.create({
    ticketNumber,
    userType,
    userId,
    ...roleFields,
    orderId: orderId || null,
    subscriptionId: subscriptionId || null,
    subscriptionOccurrenceId: subscriptionOccurrenceId || null,
    subject,
    description,
    category,
    priority,
    status: 'OPEN',
    attachments,
    messages: [
      {
        senderType: userType,
        senderId: userId,
        senderName: `${userType.charAt(0) + userType.slice(1).toLowerCase()} User`,
        message: description,
        attachments,
        isInternalNote: false,
        createdAt: new Date()
      }
    ]
  });

  return ticket;
};

/**
 * Get tickets for authenticated user (Customer, Restaurant, Delivery Partner) with pagination and filters
 */
export const getUserTickets = async (userId, userType, { page = 1, limit = 20, status, category, priority } = {}) => {
  const filter = { userId, userType };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (priority) filter.priority = priority;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const parsedLimit = Math.max(1, parseInt(limit, 10));

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate('orderId', 'orderId status grandTotal createdAt')
      .populate('subscriptionId', 'planName status totalOccurrences')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    SupportTicket.countDocuments(filter)
  ]);

  // Strip internal notes from message threads for non-admin viewers
  const sanitizedTickets = tickets.map(ticket => ({
    ...ticket,
    messages: (ticket.messages || []).filter(msg => !msg.isInternalNote)
  }));

  return {
    tickets: sanitizedTickets,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / parsedLimit)
  };
};

/**
 * SuperAdmin list all tickets across platform with filters & pagination
 */
export const getAllTicketsForAdmin = async ({
  page = 1,
  limit = 20,
  status,
  priority,
  category,
  userType,
  search
} = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;
  if (userType) filter.userType = userType;
  if (search) {
    filter.$or = [
      { ticketNumber: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const parsedLimit = Math.max(1, parseInt(limit, 10));

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .populate('orderId', 'orderId status grandTotal createdAt')
      .populate('subscriptionId', 'planName status')
      .populate('customerId', 'name email mobile')
      .populate('restaurantId', 'name mobile')
      .populate('deliveryPartnerId', 'name mobile')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    SupportTicket.countDocuments(filter)
  ]);

  return {
    tickets,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / parsedLimit)
  };
};

/**
 * Get single ticket details with IDOR ownership validation & internal note protection
 */
export const getTicketByIdService = async (ticketId, requesterId, requesterRole) => {
  const ticket = await SupportTicket.findById(ticketId)
    .populate('orderId', 'orderId status grandTotal items deliveryAddress createdAt')
    .populate('subscriptionId', 'planName status totalOccurrences price')
    .populate('customerId', 'name email mobile')
    .populate('restaurantId', 'name mobile')
    .populate('deliveryPartnerId', 'name mobile')
    .populate('assignedTo', 'name email');

  if (!ticket) {
    throw new Error('Support ticket not found');
  }

  // Strict IDOR Protection: If not SuperAdmin, ticket must belong to requester
  if (requesterRole !== 'SUPER_ADMIN' && ticket.userId.toString() !== requesterId.toString()) {
    throw new Error('Access denied to support ticket');
  }

  const ticketObj = ticket.toObject();

  // Internal Note Privacy: Filter out internal notes for non-admin users
  if (requesterRole !== 'SUPER_ADMIN') {
    ticketObj.messages = (ticketObj.messages || []).filter(msg => !msg.isInternalNote);
  }

  return ticketObj;
};

/**
 * Add a message to ticket thread with internal note support & auto-status transition
 */
export const addTicketMessageService = async (
  ticketId,
  requesterId,
  requesterRole,
  { message, senderName, attachments = [], isInternalNote = false }
) => {
  if (!message || !message.trim()) {
    throw new Error('Message is required');
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    throw new Error('Support ticket not found');
  }

  // IDOR Verification
  if (requesterRole !== 'SUPER_ADMIN' && ticket.userId.toString() !== requesterId.toString()) {
    throw new Error('Access denied to support ticket');
  }

  // Only SUPER_ADMIN / SUPPORT_AGENT can add internal notes
  const noteFlag = requesterRole === 'SUPER_ADMIN' ? Boolean(isInternalNote) : false;

  const senderType = requesterRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : ticket.userType;
  const name = senderName || (requesterRole === 'SUPER_ADMIN' ? 'SuperAdmin Agent' : `${ticket.userType} User`);

  ticket.messages.push({
    senderType,
    senderId: requesterId,
    senderName: name,
    message: message.trim(),
    attachments: Array.isArray(attachments) ? attachments : [],
    isInternalNote: noteFlag,
    createdAt: new Date()
  });

  // Automatic state machine adjustments on public reply
  if (!noteFlag) {
    if (requesterRole === 'SUPER_ADMIN') {
      if (ticket.status === 'OPEN') {
        ticket.status = 'IN_PROGRESS';
      }
    } else {
      // If user replies to a resolved or closed ticket, reopen ticket
      if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
        ticket.status = 'OPEN';
      } else if (ticket.status === 'WAITING_FOR_CUSTOMER' || ticket.status === 'WAITING_FOR_PARTNER') {
        ticket.status = 'IN_PROGRESS';
      }
    }
  }

  await ticket.save();

  const resultObj = ticket.toObject();
  if (requesterRole !== 'SUPER_ADMIN') {
    resultObj.messages = (resultObj.messages || []).filter(msg => !msg.isInternalNote);
  }
  return resultObj;
};

/**
 * Update support ticket status enforcing State Machine
 */
export const updateTicketStatusService = async (ticketId, newStatus) => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    throw new Error('Support ticket not found');
  }

  const allowedNextStatuses = VALID_STATE_TRANSITIONS[ticket.status] || [];
  if (!allowedNextStatuses.includes(newStatus) && ticket.status !== newStatus) {
    throw new Error(`Invalid status transition from ${ticket.status} to ${newStatus}`);
  }

  ticket.status = newStatus;
  if (newStatus === 'RESOLVED') {
    ticket.resolvedAt = new Date();
  }
  if (newStatus === 'CLOSED') {
    ticket.closedAt = new Date();
  }

  await ticket.save();
  return ticket;
};

/**
 * Update support ticket priority
 */
export const updateTicketPriorityService = async (ticketId, priority) => {
  if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
    throw new Error('Invalid ticket priority');
  }

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    throw new Error('Support ticket not found');
  }

  ticket.priority = priority;
  await ticket.save();
  return ticket;
};

/**
 * Assign ticket to admin staff
 */
export const assignTicketService = async (ticketId, adminId, assignerId) => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) {
    throw new Error('Support ticket not found');
  }

  ticket.assignedTo = adminId;
  ticket.assignedAt = new Date();
  ticket.assignedBy = assignerId;

  if (ticket.status === 'OPEN') {
    ticket.status = 'IN_PROGRESS';
  }

  await ticket.save();
  return ticket;
};
