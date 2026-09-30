import express from 'express';
import { getDashboard } from '../../controllers/customers/customerAuthController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Protected route (Customer JWT required)
router.get('/dashboard', protectCustomer, getDashboard);

export default router;
