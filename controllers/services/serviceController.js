import { successResponse } from '../../common/apiResponse.js';
import { asyncHandler } from '../../common/asyncHandler.js';

export const getServices = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Services retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});

export const getFeaturedServices = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Featured services retrieved successfully',
    data: []
  });
});

export const getServiceDetails = asyncHandler(async (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'Service details retrieved successfully',
    data: { service: {}, packages: [], reviews: [], rating: 0 }
  });
});

export const getServicePackages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  return successResponse(res, {
    statusCode: 200,
    message: 'Service packages retrieved successfully',
    data: [],
    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
  });
});
