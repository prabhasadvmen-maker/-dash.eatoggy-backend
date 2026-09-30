import express from 'express';
import { translateText } from '../../controllers/translation/translationController.js';

const router = express.Router();

router.post('/translate', translateText);

export default router;
