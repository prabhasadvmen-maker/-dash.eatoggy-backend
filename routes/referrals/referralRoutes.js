import express from 'express';
import { getReferral } from '../../controllers/referrals/referralController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protectCustomer, getReferral);

export default router;
