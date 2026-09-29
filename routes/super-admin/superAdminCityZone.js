import express from 'express';
import { protectSuperAdmin } from '../../middleware/authMiddleware.js';
import {
  getAllCities,
  getActiveCities,
  createCity,
  updateCity,
  deleteCity,
  addZone,
  deleteZone,
  getZoneAutocomplete
} from '../../controllers/super-admin/superAdminCityZoneController.js';

const router = express.Router();

// Public routes
router.get('/', getAllCities);
router.get('/active', getActiveCities);

// Protected routes
router.use(protectSuperAdmin);
router.get('/autocomplete-zone', getZoneAutocomplete);
router.post('/', createCity);
router.put('/:id', updateCity);
router.delete('/:id', deleteCity);
router.post('/:id/zones', addZone);
router.delete('/:id/zones/:zoneId', deleteZone);

export default router;
