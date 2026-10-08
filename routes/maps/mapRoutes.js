import express from 'express';
import { geocode, reverseGeocodeHandler, getRouteHandler } from '../../controllers/maps/mapController.js';

const router = express.Router();

router.get('/geocode', geocode);
router.get('/reverse-geocode', reverseGeocodeHandler);
router.get('/route', getRouteHandler);

export default router;
