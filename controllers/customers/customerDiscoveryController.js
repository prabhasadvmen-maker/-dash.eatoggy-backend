import Restaurant from '../../models/restaurants/Restaurant.js';
import MenuItem from '../../models/menu/MenuItem.js';
import Category from '../../models/menu/Category.js';
import Banner from '../../models/promotions/Banner.js';

/**
 * GET /api/customers/discovery/restaurants
 * Fetch all eligible restaurants for customer discovery.
 */
export const getRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({
      status: 'APPROVED',
      onboardingStatus: 'APPROVED'
    })
    .select('_id restaurantName restaurantType cuisine city fullAddress documents.restaurantImage operatingHours rating')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Restaurants fetched successfully',
      data: restaurants
    });
  } catch (error) {
    console.error('Error fetching restaurants for discovery:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * GET /api/customers/discovery/restaurants/:id
 * Fetch a specific eligible restaurant.
 */
export const getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      _id: req.params.id,
      status: 'APPROVED',
      onboardingStatus: 'APPROVED'
    })
    .select('_id restaurantName restaurantType cuisine city fullAddress documents.restaurantImage operatingHours rating');

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or not available'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Restaurant fetched successfully',
      data: restaurant
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or not available'
      });
    }
    console.error('Error fetching restaurant detail:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * GET /api/customers/discovery/restaurants/:id/menu
 * Fetch the approved menu for a specific restaurant, organized by Category -> Subcategory -> Items.
 */
export const getRestaurantMenu = async (req, res) => {
  try {
    // 1. Validate restaurant is approved
    const restaurant = await Restaurant.findOne({
      _id: req.params.id,
      status: 'APPROVED',
      onboardingStatus: 'APPROVED'
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or not available'
      });
    }

    // 2. Fetch approved and available menu items, populated with active categories and subcategories
    const menuItems = await MenuItem.find({
      restaurantId: req.params.id,
      status: 'APPROVED',
      availability: true
    })
    .populate({
      path: 'categoryId',
      match: { isActive: true },
      select: 'name sortOrder'
    })
    .populate({
      path: 'subcategoryId',
      match: { isActive: true },
      select: 'name sortOrder'
    })
    .select('_id name description price image foodType preparationTime categoryId subcategoryId sortOrder')
    .sort({ sortOrder: 1, name: 1 });

    // 3. Filter out items where category or subcategory is inactive (population returned null)
    const validItems = menuItems.filter(item => item.categoryId && item.subcategoryId);

    // 4. Organize data: Category -> Subcategory -> Items
    const menuStructure = [];

    validItems.forEach(item => {
      // Find or create category
      let categoryObj = menuStructure.find(c => c._id.toString() === item.categoryId._id.toString());
      if (!categoryObj) {
        categoryObj = {
          _id: item.categoryId._id,
          name: item.categoryId.name,
          sortOrder: item.categoryId.sortOrder,
          subcategories: []
        };
        menuStructure.push(categoryObj);
      }

      // Find or create subcategory
      let subcategoryObj = categoryObj.subcategories.find(s => s._id.toString() === item.subcategoryId._id.toString());
      if (!subcategoryObj) {
        subcategoryObj = {
          _id: item.subcategoryId._id,
          name: item.subcategoryId.name,
          sortOrder: item.subcategoryId.sortOrder,
          items: []
        };
        categoryObj.subcategories.push(subcategoryObj);
      }

      // Format item and add to subcategory
      const formattedItem = {
        _id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        foodType: item.foodType,
        preparationTime: item.preparationTime
      };
      
      subcategoryObj.items.push(formattedItem);
    });

    // Sort categories and subcategories
    menuStructure.sort((a, b) => a.sortOrder - b.sortOrder);
    menuStructure.forEach(cat => {
      cat.subcategories.sort((a, b) => a.sortOrder - b.sortOrder);
    });

    res.status(200).json({
      success: true,
      message: 'Menu fetched successfully',
      data: menuStructure
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found or not available'
      });
    }
    console.error('Error fetching restaurant menu:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

/**
 * GET /api/customers/discovery/search
 * Search globally for restaurants and menu items.
 */
export const searchGlobal = async (req, res) => {
  try {
    const { q } = req.query;
    
    // Validation: Require q to be a string of at least 2 characters
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query must be at least 2 characters long' 
      });
    }

    // Escape regex characters to prevent ReDoS
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQ, 'i');

    const restaurants = await Restaurant.find({
      status: 'APPROVED',
      onboardingStatus: 'APPROVED',
      $or: [
        { restaurantName: regex },
        { cuisine: regex },
        { city: regex },
        { fullAddress: regex }
      ]
    })
    .select('_id restaurantName restaurantType cuisine city fullAddress documents.restaurantImage operatingHours rating')
    .limit(5);

    const menuItems = await MenuItem.find({
      status: 'APPROVED',
      availability: true,
      $or: [
        { name: regex },
        { description: regex },
        { foodType: regex }
      ]
    })
    .populate({
      path: 'restaurantId',
      match: { status: 'APPROVED', onboardingStatus: 'APPROVED' },
      select: '_id restaurantName'
    })
    .select('_id name description price image foodType preparationTime restaurantId')
    .limit(10);

    // Filter out menu items whose restaurant is deactivated
    const validMenuItems = menuItems.filter(item => item.restaurantId);

    res.status(200).json({
      success: true,
      data: {
        restaurants,
        menuItems: validMenuItems
      }
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/customers/discovery/banners
 * Fetch active promotional banners for the hero carousel.
 */
export const getActiveBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await Banner.find({
      isActive: true,
      $or: [
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: null, endDate: null }
      ]
    })
    .sort({ displayOrder: 1 })
    .limit(5);

    res.status(200).json({ success: true, data: banners });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/customers/discovery/collections
 * Fetch active categories as curated collections.
 */
export const getCollections = async (req, res) => {
  try {
    const collections = await Category.find({ isActive: true })
      .select('_id name image sortOrder')
      .sort({ sortOrder: 1 })
      .limit(10);

    res.status(200).json({ success: true, data: collections });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/customers/discovery/gourmet
 * Fetch featured/top menu items across all approved restaurants.
 */
export const getGourmetCreations = async (req, res) => {
  try {
    const menuItems = await MenuItem.find({
      status: 'APPROVED',
      availability: true
    })
    .populate({
      path: 'restaurantId',
      match: { status: 'APPROVED', onboardingStatus: 'APPROVED' },
      select: '_id restaurantName cuisine city rating documents.restaurantImage'
    })
    .select('_id name description price image foodType preparationTime restaurantId rating')
    .sort({ createdAt: -1 })
    .limit(10);

    // Filter out items without an active restaurant
    const validMenuItems = menuItems.filter(item => item.restaurantId);

    res.status(200).json({ success: true, data: validMenuItems });
  } catch (error) {
    console.error('Error fetching gourmet creations:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
