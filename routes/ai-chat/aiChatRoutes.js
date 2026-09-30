import express from 'express';
import { sendChatMessage, getChatHistory } from '../../controllers/ai-chat/aiChatController.js';
import { protectCustomer } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(protectCustomer);
router.post('/', sendChatMessage);
router.get('/history', getChatHistory);

export default router;
