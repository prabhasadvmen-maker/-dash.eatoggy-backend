import express from 'express';
import { getWallet, addMoney } from '../../controllers/wallet/walletController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protectCustomer);
router.get('/', getWallet);
router.post('/add-money', addMoney);

export default router;
