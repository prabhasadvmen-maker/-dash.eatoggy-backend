import express from 'express';
import { getStarterPack } from '../../controllers/offers/starterPackController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protectCustomer, getStarterPack);

export default router;
