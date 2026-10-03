import express from 'express';
import { protectRestaurant } from '../../middleware/authMiddleware.js';
import { getNotifications, registerDeviceToken, markNotificationsRead } from '../../controllers/restaurants/restaurantNotificationController.js';

const router = express.Router();

router.use(protectRestaurant);

router.get('/', getNotifications);
router.post('/device-token', registerDeviceToken);
router.patch('/mark-read', markNotificationsRead);

export default router;
