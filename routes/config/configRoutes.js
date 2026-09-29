import express from 'express';
import { getAppConfig } from '../../controllers/config/configController.js';

const router = express.Router();

router.get('/config', getAppConfig);

export default router;
