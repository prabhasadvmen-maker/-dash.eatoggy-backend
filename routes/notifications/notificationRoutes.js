import express from 'express';
import { protectCustomer } from '../../middleware/authMiddleware.js';
import { registerFCMToken, getNotifications } from '../../controllers/notifications/notificationController.js';

const router = express.Router();

router.use(protectCustomer);
router.post('/subscribe', registerFCMToken);
router.get('/', getNotifications);

export default router;
