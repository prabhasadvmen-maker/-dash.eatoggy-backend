import express from 'express';
import { checkServiceability } from '../../controllers/serviceability/serviceabilityController.js';

const router = express.Router();

router.get('/check', checkServiceability);

export default router;
