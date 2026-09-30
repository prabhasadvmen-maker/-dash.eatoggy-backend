import express from 'express';
import {
  protect,
  protectCustomer,
  protectRestaurant,
  protectDeliveryPartner,
  protectSuperAdmin
} from '../../middleware/authMiddleware.js';
import {
  postTicket,
  getMyTickets,
  getRestaurantTickets,
  getDeliveryTickets,
  getSingleTicket,
  postTicketMessage,
  getAdminTickets,
  patchTicketStatus,
  patchTicketPriority,
  patchTicketAssignment
} from '../../controllers/support/supportTicketController.js';

const router = express.Router();

// -------------------- ROLE TICKET ENDPOINTS --------------------
// Submit ticket (Customer, Restaurant, Delivery Partner)
router.post('/support/tickets', protect, postTicket);

// Customer list my tickets
router.get('/support/tickets/my', protectCustomer, getMyTickets);

// Restaurant list my tickets
router.get('/support/tickets/restaurant/my', protectRestaurant, getRestaurantTickets);

// Delivery Partner list my tickets
router.get('/support/tickets/delivery/my', protectDeliveryPartner, getDeliveryTickets);

// Get single ticket by ID (ownership IDOR protected, internal notes filtered for non-admin)
router.get('/support/tickets/:id', protect, getSingleTicket);
router.get('/support/tickets/:id/messages', protect, getSingleTicket);

// Add message to ticket thread (user reply)
router.post('/support/tickets/:id/reply', protect, postTicketMessage);

// -------------------- SUPERADMIN HELPDESK ENDPOINTS --------------------
// Global paginated list & search
router.get('/super-admin/support/tickets', protectSuperAdmin, getAdminTickets);

// SuperAdmin get ticket detail
router.get('/super-admin/support/tickets/:id', protectSuperAdmin, getSingleTicket);

// Add official response or internal note
router.post('/super-admin/support/tickets/:id/messages', protectSuperAdmin, postTicketMessage);

// Update status (state machine)
router.patch('/super-admin/support/tickets/:id/status', protectSuperAdmin, patchTicketStatus);

// Update priority
router.patch('/super-admin/support/tickets/:id/priority', protectSuperAdmin, patchTicketPriority);

// Assign ticket
router.patch('/super-admin/support/tickets/:id/assign', protectSuperAdmin, patchTicketAssignment);

export default router;
