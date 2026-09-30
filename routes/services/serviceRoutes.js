import express from 'express';
import { getServices, getFeaturedServices, getServiceDetails, getServicePackages } from '../../controllers/services/serviceController.js';

const router = express.Router();

router.get('/', getServices);
router.get('/customer/services/featured', getFeaturedServices);
router.get('/services/details/:id', getServiceDetails);
router.get('/packages/service/:id', getServicePackages);

export default router;
