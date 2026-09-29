import SupportTicket from '../../models/support/SupportTicket.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getAllTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, priority, category, userType, search } = req.query;

  const query = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (userType) query.userType = userType;
  if (search) {
    query.$or = [
      { ticketNumber: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } }
    ];
  }

  const tickets = await SupportTicket.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await SupportTicket.countDocuments(query);

  const statusCounts = {
    OPEN: await SupportTicket.countDocuments({ status: 'OPEN' }),
    IN_PROGRESS: await SupportTicket.countDocuments({ status: 'IN_PROGRESS' }),
    RESOLVED: await SupportTicket.countDocuments({ status: 'RESOLVED' }),
    CLOSED: await SupportTicket.countDocuments({ status: 'CLOSED' }),
  };

  return successResponse(res, {
    message: 'Support tickets retrieved successfully',
    data: {
      tickets,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      },
      statusCounts
    }
  });
});

export const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);

  if (!ticket) {
    return errorResponse(res, { statusCode: 404, message: 'Ticket not found' });
  }

  return successResponse(res, {
    message: 'Ticket details retrieved successfully',
    data: { ticket }
  });
});

export const replyToTicket = asyncHandler(async (req, res) => {
  const { message, isInternalNote = false } = req.body;
  if (!message) {
    return errorResponse(res, { statusCode: 400, message: 'Message is required' });
  }

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) {
    return errorResponse(res, { statusCode: 404, message: 'Ticket not found' });
  }

  ticket.messages.push({
    senderType: 'SUPER_ADMIN',
    senderId: req.admin?.id,
    senderName: 'Super Admin',
    message,
    isInternalNote,
    createdAt: new Date()
  });

  if (ticket.status === 'OPEN' && !isInternalNote) {
    ticket.status = 'IN_PROGRESS';
  }

  await ticket.save();

  return successResponse(res, {
    message: 'Reply sent successfully',
    data: { ticket }
  });
});

export const updateTicketStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return errorResponse(res, { statusCode: 400, message: 'Status is required' });
  }

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) {
    return errorResponse(res, { statusCode: 404, message: 'Ticket not found' });
  }

  ticket.status = status;
  if (status === 'RESOLVED') {
    ticket.resolvedAt = new Date();
  } else if (status === 'CLOSED') {
    ticket.closedAt = new Date();
  }

  await ticket.save();

  return successResponse(res, {
    message: 'Ticket status updated successfully',
    data: { ticket }
  });
});

export const updateTicketPriority = asyncHandler(async (req, res) => {
  const { priority } = req.body;
  if (!priority) {
    return errorResponse(res, { statusCode: 400, message: 'Priority is required' });
  }

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) {
    return errorResponse(res, { statusCode: 404, message: 'Ticket not found' });
  }

  ticket.priority = priority;
  await ticket.save();

  return successResponse(res, {
    message: 'Ticket priority updated successfully',
    data: { ticket }
  });
});
