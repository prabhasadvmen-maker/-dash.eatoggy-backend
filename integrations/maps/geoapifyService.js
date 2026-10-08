import { logger } from '../../config/index.js';

const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;
const BASE = 'https://api.geoapify.com/v1';

/**
 * Get route between two points using Geoapify Routing API
 * Returns distance (km), duration (minutes), and turn-by-turn steps
 */
export const getRoute = async (fromLat, fromLon, toLat, toLon, mode = 'drive') => {
  try {
    const url = `${BASE}/routing?waypoints=${fromLat},${fromLon}|${toLat},${toLon}&mode=${mode}&apiKey=${GEOAPIFY_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.features || data.features.length === 0) {
      return fallbackRoute(fromLat, fromLon, toLat, toLon);
    }

    const props = data.features[0].properties;
    const legs = props.legs || [];
    const steps = [];

    legs.forEach(leg => {
      (leg.steps || []).forEach(step => {
        steps.push({
          instruction: step.instruction?.text || 'Continue',
          distanceMeters: Math.round(step.distance || 0),
          durationSeconds: Math.round(step.time || 0)
        });
      });
    });

    return {
      distanceKm: Number((props.distance / 1000).toFixed(1)),
      durationMinutes: Math.max(1, Math.round(props.time / 60)),
      steps,
      polyline: data.features[0].geometry?.coordinates || []
    };
  } catch (err) {
    logger.error('Geoapify routing error:', err.message);
    return fallbackRoute(fromLat, fromLon, toLat, toLon);
  }
};

/**
 * Geocode an address string to lat/lng
 */
export const geocodeAddress = async (address) => {
  try {
    const encoded = encodeURIComponent(address);
    const url = `${BASE}/geocode/search?text=${encoded}&apiKey=${GEOAPIFY_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.features || data.features.length === 0) return null;

    const { lat, lon } = data.features[0].properties;
    return { lat, lon, formatted: data.features[0].properties.formatted };
  } catch (err) {
    logger.error('Geoapify geocode error:', err.message);
    return null;
  }
};

/**
 * Reverse geocode lat/lng to address string
 */
export const reverseGeocode = async (lat, lon) => {
  try {
    const url = `${BASE}/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.features || data.features.length === 0) return null;

    return {
      formatted: data.features[0].properties.formatted,
      city: data.features[0].properties.city,
      postcode: data.features[0].properties.postcode
    };
  } catch (err) {
    logger.error('Geoapify reverse geocode error:', err.message);
    return null;
  }
};

// Haversine fallback when Geoapify API fails
const fallbackRoute = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  const distanceKm = Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
  const durationMinutes = Math.max(1, Math.round(distanceKm * 3));
  return { distanceKm, durationMinutes, steps: [], polyline: [] };
};
