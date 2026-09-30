import express from 'express';
import { getServices, getFeaturedServices, getServiceDetails, getServicePackages } from '../../controllers/services/serviceController.js';

const router = express.Router();

router.get('/services', getServices);
router.get('/services/featured', getFeaturedServices);
router.get('/services/:id', getServiceDetails);
router.get('/services/:id/packages', getServicePackages);

export default router;
