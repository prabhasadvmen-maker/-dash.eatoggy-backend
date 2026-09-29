import { asyncHandler } from '../../common/asyncHandler.js';
import { successResponse, errorResponse } from '../../common/apiResponse.js';
import Category from '../../models/menu/Category.js';

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const MenuItem = (await import('../../models/menu/MenuItem.js')).default;
  const itemCounts = await MenuItem.aggregate([
    { $match: { isAvailable: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);

  const countMap = {};
  itemCounts.forEach(item => {
    if (item._id) countMap[item._id.toString()] = item.count;
  });

  return successResponse(res, {
    message: 'Categories retrieved successfully',
    data: categories.map(cat => ({
      id: cat._id,
      name: cat.name,
      imageUrl: cat.image || '',
      description: cat.description || '',
      itemCount: countMap[cat._id.toString()] || 0,
      priority: cat.sortOrder || 0
    }))
  });
});
