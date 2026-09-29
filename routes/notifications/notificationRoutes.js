import express from 'express';
import { protectCustomer } from '../../middleware/authMiddleware.js';
import { registerFCMToken } from '../../controllers/notifications/notificationController.js';

const router = express.Router();

router.post('/subscribe', protectCustomer, registerFCMToken);

export default router;
