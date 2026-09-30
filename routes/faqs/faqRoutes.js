import express from 'express';
import { getFaqs } from '../../controllers/faqs/faqController.js';

const router = express.Router();

router.get('/', getFaqs);

export default router;
