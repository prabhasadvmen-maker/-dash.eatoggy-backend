import {
  createTicket,
  getUserTickets,
  getAllTicketsForAdmin,
  getTicketByIdService,
  addTicketMessageService,
  updateTicketStatusService,
  updateTicketPriorityService,
  assignTicketService
} from '../../services/support/supportTicketService.js';

/**
 * Helper to resolve requester identity and role from auth req object
 */
const resolveIdentity = (req) => {
  if (req.customer || req.user?.role === 'customer') {
    const id = req.customer?.id || req.customer?._id || req.user?.id || req.user?._id;
    return { userId: id, userType: 'CUSTOMER', role: 'CUSTOMER' };
  }
  if (req.restaurant || req.user?.role === 'restaurant') {
    const id = req.restaurant?.id || req.restaurant?._id || req.user?.id || req.user?._id;
    return { userId: id, userType: 'RESTAURANT', role: 'RESTAURANT' };
  }
  if (req.deliveryPartner || req.user?.role === 'delivery') {
    const id = req.deliveryPartner?.id || req.deliveryPartner?._id || req.user?.id || req.user?._id;
    return { userId: id, userType: 'DELIVERY_PARTNER', role: 'DELIVERY_PARTNER' };
  }
  if (req.admin || req.user?.role === 'superadmin' || req.user?.role === 'admin') {
    const id = req.admin?.id || req.admin?._id || req.user?.id || req.user?._id;
    return { userId: id, userType: 'SUPER_ADMIN', role: 'SUPER_ADMIN' };
  }
  const fallbackId = req.user?.id || req.user?._id;
  return { userId: fallbackId, userType: 'CUSTOMER', role: 'CUSTOMER' };
};

/**
 * Submit support ticket
 */
export const postTicket = async (req, res) => {
  try {
    const { userId, userType } = resolveIdentity(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
      subject,
      description,
      category,
      priority,
      orderId,
      subscriptionId,
      subscriptionOccurrenceId,
      attachments
    } = req.body;

    const ticket = await createTicket({
      userType,
      userId,
      subject,
      description,
      category,
      priority,
      orderId,
      subscriptionId,
      subscriptionOccurrenceId,
      attachments
    });

    res.status(201).json({ success: true, message: 'Support ticket created successfully', data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Fetch Customer tickets
 */
export const getMyTickets = async (req, res) => {
  try {
    const { userId } = resolveIdentity(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await getUserTickets(userId, 'CUSTOMER', req.query);
    // Backward compatibility: if no pagination params, return data array directly or wrapped in result object
    res.json({
      success: true,
      data: result.tickets,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch Restaurant tickets
 */
export const getRestaurantTickets = async (req, res) => {
  try {
    const { userId } = resolveIdentity(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await getUserTickets(userId, 'RESTAURANT', req.query);
    res.json({
      success: true,
      data: result.tickets,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch Delivery Partner tickets
 */
export const getDeliveryTickets = async (req, res) => {
  try {
    const { userId } = resolveIdentity(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await getUserTickets(userId, 'DELIVERY_PARTNER', req.query);
    res.json({
      success: true,
      data: result.tickets,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch Single Ticket Details by ID (with IDOR Protection)
 */
export const getSingleTicket = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { userId, role } = resolveIdentity(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const ticket = await getTicketByIdService(ticketId, userId, role);
    res.json({ success: true, data: ticket });
  } catch (error) {
    const status = error.message.includes('denied') ? 403 : error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Add message to support ticket thread
 */
export const postTicketMessage = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { userId, role } = resolveIdentity(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { message, senderName, attachments, isInternalNote } = req.body;

    const ticket = await addTicketMessageService(ticketId, userId, role, {
      message,
      senderName,
      attachments,
      isInternalNote
    });

    res.json({ success: true, message: 'Message added to ticket', data: ticket });
  } catch (error) {
    const status = error.message.includes('denied') ? 403 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: List all support tickets across platform with filters
 */
export const getAdminTickets = async (req, res) => {
  try {
    const result = await getAllTicketsForAdmin(req.query);
    res.json({
      success: true,
      data: result.tickets,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Update ticket status
 */
export const patchTicketStatus = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { status } = req.body;

    const ticket = await updateTicketStatusService(ticketId, status);
    res.json({ success: true, message: 'Ticket status updated', data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Update ticket priority
 */
export const patchTicketPriority = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { priority } = req.body;

    const ticket = await updateTicketPriorityService(ticketId, priority);
    res.json({ success: true, message: 'Ticket priority updated', data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * SuperAdmin: Assign ticket to staff
 */
export const patchTicketAssignment = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { adminId } = req.body;
    const { userId: assignerId } = resolveIdentity(req);

    const ticket = await assignTicketService(ticketId, adminId, assignerId);
    res.json({ success: true, message: 'Ticket assigned successfully', data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
