import CityZone from '../../models/super-admin/CityZone.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

// GET all cities with zones
export const getAllCities = asyncHandler(async (req, res) => {
  const { search, isActive } = req.query;
  const query = {};
  if (search) query.city = { $regex: search, $options: 'i' };
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const cities = await CityZone.find(query).sort({ city: 1 });
  return successResponse(res, { message: 'Cities retrieved successfully', data: cities });
});

// GET active cities only (public - for frontend dropdowns)
export const getActiveCities = asyncHandler(async (req, res) => {
  const cities = await CityZone.find({ isActive: true }).sort({ city: 1 });
  return successResponse(res, { message: 'Active cities retrieved', data: cities });
});

// POST create city
export const createCity = asyncHandler(async (req, res) => {
  const { city, zones = [] } = req.body;
  if (!city) return errorResponse(res, { statusCode: 400, message: 'City name is required' });

  const existing = await CityZone.findOne({ city: { $regex: `^${city}$`, $options: 'i' } });
  if (existing) return errorResponse(res, { statusCode: 400, message: 'City already exists' });

  const cityZone = await CityZone.create({
    city: city.trim(),
    zones: zones.map(z => ({ name: z.trim() })).filter(z => z.name)
  });

  return successResponse(res, { statusCode: 201, message: 'City created successfully', data: cityZone });
});

// PUT update city name & toggle active
export const updateCity = asyncHandler(async (req, res) => {
  const { city, isActive } = req.body;
  const cityZone = await CityZone.findById(req.params.id);
  if (!cityZone) return errorResponse(res, { statusCode: 404, message: 'City not found' });

  if (city) cityZone.city = city.trim();
  if (isActive !== undefined) cityZone.isActive = isActive;
  await cityZone.save();

  return successResponse(res, { message: 'City updated successfully', data: cityZone });
});

// DELETE city
export const deleteCity = asyncHandler(async (req, res) => {
  const cityZone = await CityZone.findByIdAndDelete(req.params.id);
  if (!cityZone) return errorResponse(res, { statusCode: 404, message: 'City not found' });
  return successResponse(res, { message: 'City deleted successfully' });
});

// POST add zone to city
export const addZone = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return errorResponse(res, { statusCode: 400, message: 'Zone name is required' });

  const cityZone = await CityZone.findById(req.params.id);
  if (!cityZone) return errorResponse(res, { statusCode: 404, message: 'City not found' });

  const exists = cityZone.zones.some(z => z.name.toLowerCase() === name.toLowerCase().trim());
  if (exists) return errorResponse(res, { statusCode: 400, message: 'Zone already exists in this city' });

  cityZone.zones.push({ name: name.trim() });
  await cityZone.save();

  return successResponse(res, { message: 'Zone added successfully', data: cityZone });
});

// DELETE zone from city
export const deleteZone = asyncHandler(async (req, res) => {
  const cityZone = await CityZone.findById(req.params.id);
  if (!cityZone) return errorResponse(res, { statusCode: 404, message: 'City not found' });

  cityZone.zones = cityZone.zones.filter(z => z._id.toString() !== req.params.zoneId);
  await cityZone.save();

  return successResponse(res, { message: 'Zone deleted successfully', data: cityZone });
});

// GET /autocomplete-zone
export const getZoneAutocomplete = asyncHandler(async (req, res) => {
  const { city, q } = req.query;
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    return errorResponse(res, { statusCode: 500, message: 'Geoapify API key is not configured' });
  }
  if (!city) {
    return errorResponse(res, { statusCode: 400, message: 'City is required' });
  }

  // Combine query and city for better results, e.g., "Rohini, Delhi"
  let searchText = city;
  if (q && q.trim()) {
    searchText = `${q.trim()}, ${city}`;
  }

  try {
    // Use generic autocomplete to get all matching places
    const geoUrl = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(searchText)}&filter=countrycode:in&apiKey=${apiKey}&limit=15`;
    
    // We can use native fetch in Node 18+
    const response = await fetch(geoUrl);
    const data = await response.json();
    
    if (!response.ok) {
      return errorResponse(res, { statusCode: response.status, message: data.message || 'Error fetching from Geoapify' });
    }

    // Extract unique names from the results
    const areas = [];
    if (data && data.features) {
      data.features.forEach(f => {
        const props = f.properties;
        // Prefer suburb or neighborhood over generic name
        let name = props.suburb || props.neighborhood || props.name || props.locality;
        
        // Filter out unwanted generic OpenStreetMap admin names
        if (name && !areas.includes(name)) {
          const lowerName = name.toLowerCase();
          // Exclude "Zone X" or "District" or exact city name match if we want localities
          if (!lowerName.includes('zone ') && !lowerName.includes('district') && lowerName !== city.toLowerCase()) {
            areas.push(name);
          }
        }
      });
    }

    return successResponse(res, { message: 'Suggestions fetched', data: areas });
  } catch (err) {
    return errorResponse(res, { statusCode: 500, message: err.message });
  }
});
