import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import * as superAdminSupportController from '../../controllers/super-admin/superAdminSupportController.js';

const router = express.Router();

router.use(protectSuperAdmin);

router.get('/support/tickets', superAdminSupportController.getAllTickets);
router.get('/support/tickets/:id', superAdminSupportController.getTicketById);
router.post('/support/tickets/:id/reply', superAdminSupportController.replyToTicket);
router.patch('/support/tickets/:id/status', superAdminSupportController.updateTicketStatus);
router.patch('/support/tickets/:id/priority', superAdminSupportController.updateTicketPriority);

export default router;
