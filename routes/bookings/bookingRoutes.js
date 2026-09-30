import express from 'express';
import { getMyBookings } from '../../controllers/bookings/bookingController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/my-bookings', protectCustomer, getMyBookings);

export default router;
