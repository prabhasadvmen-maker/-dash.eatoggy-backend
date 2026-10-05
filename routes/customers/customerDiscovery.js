import express from 'express';
import { protectCustomer } from '../../middleware/authMiddleware.js';
import {
  getRestaurants,
  getRestaurantById,
  getRestaurantMenu,
  searchGlobal,
  getActiveBanners,
  getCollections,
  getGourmetCreations
} from '../../controllers/customers/customerDiscoveryController.js';

const router = express.Router();

// Public routes — no auth required for guest browsing
router.get('/restaurants', getRestaurants);
router.get('/restaurants/:id', getRestaurantById);
router.get('/restaurants/:id/menu', getRestaurantMenu);

// New Routes
router.get('/search', searchGlobal);
router.get('/banners', getActiveBanners);
router.get('/collections', getCollections);
router.get('/gourmet', getGourmetCreations);

export default router;
