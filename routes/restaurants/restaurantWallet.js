import express from 'express';
import { protectRestaurant } from '../../middleware/authMiddleware.js';
import { getRestaurantWallet, getWalletTransactions, requestWithdrawal } from '../../controllers/wallet/walletController.js';

const router = express.Router();

router.use(protectRestaurant);

router.get('/', getRestaurantWallet);
router.get('/transactions', getWalletTransactions);
router.post('/withdraw', requestWithdrawal);

export default router;
